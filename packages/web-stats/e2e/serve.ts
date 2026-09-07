// Bun-side pieces the two setups share: the fixture's public storage on a deployment, a Vite
// build and preview of the app for one run, the registry-claimed port the preview binds.
import { type ChildProcess, execFileSync, spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { Fr } from '@aztec/aztec.js/fields';
import { lanePortBase, runPortWindowBase } from '../../../scripts/run/port-window.ts';
import { claim } from '../../../scripts/run/registry.ts';
import type { Deployment } from '../../deploy/src/deploy.ts';
import { PARAMS } from '../../miner-core/src/generated/params.ts';
import { rowsFromJson } from '../../miner-core/src/reader.ts';
import { deriveSlotTable, loadLayouts } from '../../miner-core/src/slots.ts';

export const pkg = resolve(import.meta.dir, '..');
export const FIXTURE = resolve(pkg, '../miner-core/fixtures/epochs.testnet.json');

/** Public storage, slot by slot, that reproduces the captured testnet history on this deployment. */
export async function mockStorage(d: Deployment): Promise<Record<string, Record<string, string>>> {
  const layouts = await loadLayouts();
  const layout = layouts.miner;
  const rows = rowsFromJson(await Bun.file(FIXTURE).text());
  const table = await deriveSlotTable(layout, 0);
  const slot = (name: string) => {
    const s = layout[name]?.slot;
    if (!s) throw new Error(`no slot ${name}`);
    return s.toString();
  };
  const hex = (v: bigint) => new Fr(v).toString();
  const miner: Record<string, string> = { [slot('open_epoch')]: hex(BigInt(rows.length - 1)) };
  let claims = 0n;
  for (const r of rows) {
    const base = (table.epochs[r.epoch] as Fr).toBigInt();
    miner[hex(base)] = hex(r.target);
    miner[hex(base + 1n)] = hex(r.seed ?? 0n);
    miner[hex(base + 2n)] = hex(BigInt(r.openedAt));
    miner[(table.claims[r.epoch] as Fr).toString()] = hex(BigInt(r.claims));
    claims += BigInt(r.claims);
  }
  const supplySlot = layouts.token.total_supply?.slot;
  if (!supplySlot) throw new Error('the token layout has no total_supply');
  return { [d.miner]: miner, [d.token]: { [supplySlot.toString()]: hex(claims * PARAMS.REWARD) } };
}

export function buildApp(outDir: string, log: number, env: NodeJS.ProcessEnv): void {
  execFileSync('bunx', ['vite', 'build', '--outDir', outDir, '--emptyOutDir'], {
    cwd: pkg,
    stdio: ['ignore', log, log],
    env,
  });
}

/** `vite preview` in its own process group, so a teardown can kill exactly it. */
export function startPreview(
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

/** The stats lane (4) of this run's port window, owned by `ownerPid`. */
export const claimPreviewPort = (runId: string, ownerPid: number): Promise<number> =>
  claim({
    runId,
    service: 'vite',
    ownerPid,
    worktree: resolve(pkg, '../..'),
    base: lanePortBase(runPortWindowBase(runId), 4, 8),
    span: 8,
  });
