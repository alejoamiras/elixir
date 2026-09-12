// The pinned toolchain and the process primitives every local runner shares: a binary resolved
// from `.aztecrc`'s version (never `~/.aztec/current`, a machine-global symlink any agent may move),
// a detached child in its own process group, and a JSON-RPC readiness probe that races the child's
// exit so a foreign process on a claimed port is never mistaken for ours.
import { type ChildProcess, spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

export const repoRoot = resolve(import.meta.dir, '../..');

export interface Owned {
  name: string;
  child: ChildProcess;
  pgid: number;
  hasExited: () => boolean;
}

export function toolchainBin(name: string): string {
  let pin = '';
  try {
    pin = readFileSync(join(repoRoot, '.aztecrc'), 'utf8').trim();
  } catch {
    return name; // no pin: whatever PATH provides
  }
  const bin = join(homedir(), '.aztec', 'versions', pin, 'bin', name);
  if (!existsSync(bin)) throw new Error(`aztec ${pin} is pinned by .aztecrc but ${bin} is missing`);
  return bin;
}

export function spawnDetached(
  name: string,
  cmd: string,
  args: string[],
  env: Record<string, string>,
  verbose: boolean,
): Owned {
  const child = spawn(cmd, args, {
    cwd: repoRoot,
    env: { ...process.env, ...env },
    detached: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const onData = (b: Buffer) => {
    if (verbose) process.stdout.write(`[${name}] ${b.toString()}`);
  };
  child.stdout?.on('data', onData);
  child.stderr?.on('data', onData);
  let exited = false;
  child.on('exit', () => {
    exited = true;
  });
  child.on('error', () => {
    exited = true;
  });
  return { name, child, pgid: child.pid ?? -1, hasExited: () => exited };
}

export function killOwned(o: Owned): void {
  try {
    // pgid <= 1 means the spawn failed: never kill(-1)/kill(-0).
    if (o.pgid > 1) process.kill(-o.pgid, 'SIGKILL');
    else o.child.kill('SIGKILL');
  } catch {
    /* already gone */
  }
}

export async function jsonRpcReady(
  url: string,
  method: string,
  timeoutMs: number,
  owned: Owned,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  let lastError = '';
  while (Date.now() < deadline) {
    if (owned.hasExited())
      throw new Error(`${owned.name} exited before readiness (port in use or spawn failed)`);
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', method, params: [], id: 1 }),
      });
      const body = (await res.json()) as { result?: unknown; error?: unknown };
      if (res.ok && body.result !== undefined) return;
      lastError = body.error ? JSON.stringify(body.error) : `${res.status}`;
    } catch (e) {
      lastError = e instanceof Error ? e.message : String(e);
    }
    await delay(500);
  }
  throw new Error(`${url} (${method}) not ready in ${timeoutMs}ms: ${lastError}`);
}
