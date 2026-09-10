// A Vite build and `vite preview` of one app for one run, on a registry-claimed port: the pieces
// every fixture-only lane shares (the stats screenshot gate, the miner's replay lane), bound to a
// package directory by the caller.
import { type ChildProcess, execFileSync, spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { lanePortBase, runPortWindowBase } from './port-window.ts';
import { claim } from './registry.ts';

export function buildApp(pkg: string, outDir: string, log: number, env: NodeJS.ProcessEnv): void {
  execFileSync('bunx', ['vite', 'build', '--outDir', outDir, '--emptyOutDir'], {
    cwd: pkg,
    stdio: ['ignore', log, log],
    env,
  });
}

/** `vite preview` in its own process group, so a teardown can kill exactly it. */
export function startPreview(
  pkg: string,
  outDir: string,
  log: number,
  port: number,
  env: NodeJS.ProcessEnv,
): ChildProcess {
  const args = [
    'vite',
    'preview',
    '--outDir',
    outDir,
    '--port',
    String(port),
    '--strictPort',
    '--host',
    'localhost',
  ];
  const child = spawn('bunx', args, { cwd: pkg, stdio: ['ignore', log, log], detached: true, env });
  child.unref();
  return child;
}

/**
 * `localhost` can bind one loopback family while this process resolves the other (a container):
 * the probe tries both addresses; the page's own `localhost` URL reaches whichever is bound.
 */
export async function waitUntilUp(baseURL: string, child: ChildProcess): Promise<boolean> {
  const { hostname, port } = new URL(baseURL);
  const probes =
    hostname === 'localhost' ? [`http://127.0.0.1:${port}/`, `http://[::1]:${port}/`] : [`${baseURL}/`];
  const up = (url: string) =>
    fetch(url).then(
      (r) => r.ok,
      () => false,
    );
  for (let i = 0; i < 120 && child.exitCode === null; i++) {
    for (const probe of probes) if (await up(probe)) return true;
    await delay(500);
  }
  return false;
}

/** The preview's port in lane `laneIndex` of this run's window, owned by `ownerPid`. */
export const claimPreviewPort = (o: {
  runId: string;
  ownerPid: number;
  worktree: string;
  laneIndex: number;
}): Promise<number> =>
  claim({
    runId: o.runId,
    service: 'vite',
    ownerPid: o.ownerPid,
    worktree: o.worktree,
    base: lanePortBase(runPortWindowBase(o.runId), o.laneIndex, 8),
    span: 8,
  });
