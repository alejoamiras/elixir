// The pinned toolchain and the process primitives every local runner shares: a binary resolved
// from `.aztecrc`'s version (never `~/.aztec/current`, a machine-global symlink any agent may move),
// a detached child in its own process group, and a JSON-RPC readiness probe that races the child's
// exit so a foreign process on a claimed port is never mistaken for ours.
import { type ChildProcess, spawn } from 'node:child_process';
import { createWriteStream, existsSync, mkdirSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

export const repoRoot = resolve(import.meta.dir, '../..');

export interface Owned {
  name: string;
  child: ChildProcess;
  pgid: number;
  hasExited: () => boolean;
  /** The child's last lines of output, for the error of a child that died before readiness. */
  tail: () => string;
}

const TAIL_LINES = 40;

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

/**
 * A child in its own process group, its output kept as a 40-line tail for error messages and, when
 * `logFile` is given, appended there in full (the file outlives the run's data dir).
 */
export function spawnDetached(
  name: string,
  cmd: string,
  args: string[],
  env: Record<string, string>,
  verbose: boolean,
  logFile?: string,
): Owned {
  const child = spawn(cmd, args, {
    cwd: repoRoot,
    env: { ...process.env, ...env },
    detached: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  if (logFile) mkdirSync(dirname(logFile), { recursive: true });
  const log = logFile ? createWriteStream(logFile, { flags: 'a' }) : undefined;
  const tail: string[] = [];
  const onData = (b: Buffer) => {
    if (verbose) process.stdout.write(`[${name}] ${b.toString()}`);
    log?.write(b);
    tail.push(
      ...b
        .toString()
        .split('\n')
        .filter((l) => l.length > 0),
    );
    if (tail.length > TAIL_LINES) tail.splice(0, tail.length - TAIL_LINES);
  };
  child.stdout?.on('data', onData);
  child.stderr?.on('data', onData);
  let exited = false;
  child.on('exit', () => {
    exited = true;
    log?.end();
  });
  child.on('error', (e) => {
    exited = true;
    tail.push(`spawn error: ${e.message}`);
  });
  return {
    name,
    child,
    pgid: child.pid ?? -1,
    hasExited: () => exited || child.exitCode !== null || child.signalCode !== null,
    tail: () => tail.join('\n'),
  };
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
      throw new Error(
        `${owned.name} exited before readiness (port in use or spawn failed):\n${owned.tail()}`,
      );
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
  throw new Error(`${url} (${method}) not ready in ${timeoutMs}ms: ${lastError}\n${owned.tail()}`);
}

/** One digest over a directory's files (sorted relative paths and contents), for pinning vendored source trees. */
export function treeDigest(dir: string): string {
  const hasher = new Bun.CryptoHasher('sha256');
  for (const rel of readdirSync(dir, { recursive: true, encoding: 'utf8' }).sort()) {
    const path = join(dir, rel);
    if (!statSync(path).isFile()) continue;
    hasher.update(`${rel}\0`).update(readFileSync(path)).update('\0');
  }
  return hasher.digest('hex');
}
