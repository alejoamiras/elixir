// Isolated, parallel-safe Aztec local network: our own anvil + `aztec start --local-network` on
// registry-claimed ports (never 8545/8080), each in its own process group, data on real disk.
// Readiness races the owned child's exit so a foreign process on a claimed port is never
// mistaken for ours; signal handlers are installed before the first spawn so an interrupt
// during startup cannot orphan the children. Teardown kills only the groups this run owns.
//
//   const node = await startIsolatedNode();  …  await node.teardown();
//   bun scripts/run/isolated-node.ts --smoke            boot → probe → teardown
//   bun scripts/run/isolated-node.ts -- <cmd> [args…]   run <cmd> with AZTEC_NODE_URL / L1_RPC_URL set
import { type ChildProcess, spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { lanePortBase, runPortWindowBase } from './port-window.ts';
import { claim, release } from './registry.ts';

const repoRoot = resolve(import.meta.dir, '../..');

export interface IsolatedNode {
  nodeUrl: string;
  l1RpcUrl: string;
  runId: string;
  runRoot: string;
  teardown: () => Promise<void>;
}

export interface IsolatedNodeOptions {
  /** Extra env for the aztec process (e.g. sequencer/prover toggles). */
  env?: Record<string, string>;
  /** Forward child stdout/stderr to ours (also ELIXIR_NODE_VERBOSE=1). */
  verbose?: boolean;
}

interface Owned {
  name: string;
  child: ChildProcess;
  pgid: number;
  hasExited: () => boolean;
}

// `.aztecrc` pins the toolchain version; `~/.aztec/current` is a machine-global symlink that
// any agent may move, so resolve the pinned version's binaries directly when they exist.
function toolchainBin(name: string): string {
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

function spawnDetached(
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

function killOwned(o: Owned): void {
  try {
    // pgid <= 1 means the spawn failed: never kill(-1)/kill(-0).
    if (o.pgid > 1) process.kill(-o.pgid, 'SIGKILL');
    else o.child.kill('SIGKILL');
  } catch {
    /* already gone */
  }
}

async function jsonRpcReady(url: string, method: string, timeoutMs: number, owned: Owned): Promise<void> {
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

interface Ports {
  anvil: number;
  aztec: number;
  admin: number;
  p2p: number;
}

async function claimPorts(runId: string): Promise<Ports> {
  const windowBase = runPortWindowBase(runId);
  const svc = (service: string, lane: number) =>
    claim({
      runId,
      service,
      ownerPid: process.pid,
      worktree: repoRoot,
      base: lanePortBase(windowBase, lane, 8),
      span: 8,
    });
  return {
    anvil: await svc('anvil', 0),
    aztec: await svc('aztec', 1),
    admin: await svc('aztecAdmin', 2),
    p2p: await svc('aztecP2p', 3),
  };
}

function aztecArgs(ports: Ports, runRoot: string, l1RpcUrl: string): string[] {
  return [
    'start',
    '--local-network',
    '--l1-rpc-urls',
    l1RpcUrl,
    '--port',
    String(ports.aztec),
    '--admin-port',
    String(ports.admin),
    '--data-directory',
    join(runRoot, 'aztec'),
    '--world-state-data-directory',
    join(runRoot, 'aztec-world-state'),
    '--p2p.p2pPort',
    String(ports.p2p),
    '--p2p.p2pBroadcastPort',
    String(ports.p2p),
  ];
}

export async function startIsolatedNode(opts: IsolatedNodeOptions = {}): Promise<IsolatedNode> {
  const verbose = opts.verbose ?? process.env.ELIXIR_NODE_VERBOSE === '1';
  // Time + pid + random suffix: two starts in the same millisecond cannot share a runRoot.
  const runId = `elixir-${new Date().toISOString().replace(/[:.]/g, '-')}-${process.pid}-${randomUUID().slice(0, 8)}`;
  const ports = await claimPorts(runId);
  const runRoot = resolve(repoRoot, '.localnet', runId);
  mkdirSync(runRoot, { recursive: true });
  // Child scratch on real disk (never the RAM-backed /tmp) and on a SHORT path: the native
  // backend opens a UNIX socket under TMPDIR and sun_path is capped at 108 bytes.
  const childTmp = join(homedir(), '.cache', 'tmp');
  mkdirSync(childTmp, { recursive: true });
  const l1RpcUrl = `http://127.0.0.1:${ports.anvil}`;
  const nodeUrl = `http://127.0.0.1:${ports.aztec}`;
  const owned: Owned[] = [];
  let torn = false;
  const teardown = async (): Promise<void> => {
    if (torn) return;
    torn = true;
    process.off('SIGINT', onSignal);
    process.off('SIGTERM', onSignal);
    for (const o of [...owned].reverse()) killOwned(o);
    await release(runId).catch(() => {});
    rmSync(runRoot, { recursive: true, force: true });
  };
  const onSignal = () => {
    void teardown().finally(() => process.exit(130));
  };
  process.on('SIGINT', onSignal);
  process.on('SIGTERM', onSignal);

  try {
    const anvil = spawnDetached(
      'anvil',
      toolchainBin('aztec-anvil'),
      ['--host', '127.0.0.1', '--port', String(ports.anvil), '--silent'],
      { TMPDIR: childTmp },
      verbose,
    );
    owned.push(anvil);
    await jsonRpcReady(l1RpcUrl, 'eth_chainId', 60_000, anvil);
    const aztec = spawnDetached(
      'aztec',
      toolchainBin('aztec'),
      aztecArgs(ports, runRoot, l1RpcUrl),
      { ETHEREUM_HOSTS: l1RpcUrl, TMPDIR: childTmp, ...opts.env },
      verbose,
    );
    owned.push(aztec);
    await jsonRpcReady(nodeUrl, 'node_getNodeInfo', 240_000, aztec);
  } catch (e) {
    await teardown();
    throw e;
  }
  return { nodeUrl, l1RpcUrl, runId, runRoot, teardown };
}

async function runWithNode(cmd: string[]): Promise<number> {
  const node = await startIsolatedNode();
  console.info(`isolated node ready: ${node.nodeUrl} (L1 ${node.l1RpcUrl}, run ${node.runId})`);
  try {
    const [bin, ...args] = cmd;
    if (!bin) return 0;
    const child = spawn(bin, args, {
      stdio: 'inherit',
      env: {
        ...process.env,
        AZTEC_NODE_URL: node.nodeUrl,
        L1_RPC_URL: node.l1RpcUrl,
        ELIXIR_RUN_ID: node.runId,
      },
    });
    return await new Promise<number>((res) => child.on('exit', (code) => res(code ?? 1)));
  } finally {
    await node.teardown();
  }
}

if (import.meta.main) {
  // `bun script.ts -- cmd` may or may not keep the `--` (bun consumes it); either way the rest is the command.
  const argv = process.argv.slice(2).filter((a) => a !== '--smoke');
  const sep = argv.indexOf('--');
  const cmd = sep >= 0 ? argv.slice(sep + 1) : argv;
  if (!cmd.length && !process.argv.includes('--smoke'))
    throw new Error('usage: isolated-node.ts --smoke | -- <cmd> [args…]');
  if (argv.includes('--smoke')) {
    const node = await startIsolatedNode();
    console.info(`SMOKE OK — node at ${node.nodeUrl}, run ${node.runId}; tearing down.`);
    await node.teardown();
    process.exit(0);
  }
  process.exit(await runWithNode(cmd));
}
