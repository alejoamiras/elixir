// Host-level run registry under ~/.agents: the shared, human-readable ports.md every agent on
// the machine consults, plus a race-free port allocator (atomic mkdir lock). Rows whose owner
// pid is dead are dropped on every read, so a crashed run never leaks a port.
import { existsSync, mkdirSync, readFileSync, rmSync, statSync, unlinkSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

// ELIXIR_AGENTS_DIR overrides (tests use a throwaway dir); otherwise ~/.agents only when an
// operator already created it, else a gitignored dir inside the repo. A project command must
// never seed shared state into a contributor's home uninvited.
const repoLocalAgentsDir = join(import.meta.dir, '../..', '.localnet', 'agents');
const dir = (): string => {
  if (process.env.ELIXIR_AGENTS_DIR) return process.env.ELIXIR_AGENTS_DIR;
  const host = join(homedir(), '.agents');
  return existsSync(host) ? host : repoLocalAgentsDir;
};
const file = (): string => join(dir(), 'ports.md');
const lock = (): string => join(dir(), 'ports.lock');
const lockOwner = (): string => join(lock(), 'owner');

const alive = (pid: number): boolean => {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};

// A lock left behind by a SIGKILLed holder would block everyone forever: reclaim it when its
// recorded owner pid is dead. A stray 0-byte FILE at the lock path (older convention) is never
// a live lock and is removed.
function reclaimStaleLock(): void {
  try {
    const st = statSync(lock());
    if (st.isFile()) {
      unlinkSync(lock());
      return;
    }
    let ownerAlive = true;
    try {
      ownerAlive = alive(Number(readFileSync(lockOwner(), 'utf8').trim()));
    } catch {
      // No owner file yet: the holder is between mkdir and writeFile, or died right there.
      // Only the latter is reclaimable, so give the holder a grace period before deciding.
      ownerAlive = Date.now() - st.mtimeMs < 2000;
    }
    if (!ownerAlive) rmSync(lock(), { recursive: true, force: true });
  } catch {
    /* vanished between mkdir and stat — retry */
  }
}

async function withLock<T>(fn: () => T): Promise<T> {
  mkdirSync(dir(), { recursive: true });
  for (let i = 0; i < 400; i++) {
    try {
      mkdirSync(lock());
      writeFileSync(lockOwner(), String(process.pid));
    } catch {
      reclaimStaleLock();
      await new Promise((r) => setTimeout(r, 25));
      continue;
    }
    try {
      return fn();
    } finally {
      rmSync(lock(), { recursive: true, force: true });
    }
  }
  throw new Error('run-registry: lock timeout (stale ~/.agents/ports.lock dir? remove it)');
}

export interface Row {
  runId: string;
  service: string;
  port: number;
  pid: number;
  worktree: string;
  started: string;
}

// Column layout matches the pre-existing ~/.agents/ports.md header so other agents' tooling
// reads the same shape: | port | service | owner (run) | worktree | pid-hint | claimed |
function read(): Row[] {
  if (!existsSync(file())) return [];
  return readFileSync(file(), 'utf8')
    .split('\n')
    .map((l) => l.split('|').map((c) => c.trim()))
    .filter((c) => c.length >= 8 && /^\d+$/.test(c[1] ?? '') && /^\d+$/.test(c[5] ?? ''))
    .map((c) => ({
      port: Number(c[1]),
      service: c[2] ?? '',
      runId: c[3] ?? '',
      worktree: c[4] ?? '',
      pid: Number(c[5]),
      started: c[6] ?? '',
    }));
}

function write(rows: Row[]): void {
  const head =
    '# Ports registry — who is RUNNING what, where (atomic-locked)\n\n' +
    '| port | service | owner (run) | worktree | pid-hint | claimed |\n' +
    '|---|---|---|---|---|---|\n';
  const body = rows
    .map((r) => `| ${r.port} | ${r.service} | ${r.runId} | ${r.worktree} | ${r.pid} | ${r.started} |`)
    .join('\n');
  writeFileSync(file(), `${head}${body}\n`);
}

export interface ClaimOptions {
  runId: string;
  service: string;
  /** Must be a long-lived process (the run supervisor): liveness reaping keys off it. */
  ownerPid: number;
  worktree: string;
  base: number;
  span: number;
}

/** Reserve the first free port in [base, base + span) for one service of one run. */
export const claim = (o: ClaimOptions): Promise<number> =>
  withLock(() => {
    const rows = read().filter((r) => alive(r.pid));
    const taken = new Set(rows.map((r) => r.port));
    let port = o.base;
    while (taken.has(port)) {
      if (++port >= o.base + o.span) {
        throw new Error(`run-registry: no free port in ${o.base}-${o.base + o.span} for ${o.service}`);
      }
    }
    rows.push({
      runId: o.runId,
      service: o.service,
      port,
      pid: o.ownerPid,
      worktree: o.worktree,
      started: new Date().toISOString(),
    });
    write(rows);
    return port;
  });

/** Drop every row of one run (and any dead-owner rows found on the way). */
export const release = (runId: string): Promise<void> =>
  withLock(() => write(read().filter((r) => r.runId !== runId && alive(r.pid))));

/** Live rows, for diagnostics ("is this port mine?"). */
export const rows = (): Promise<Row[]> => withLock(() => read().filter((r) => alive(r.pid)));
