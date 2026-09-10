// Bun-side pieces the two setups share: the fixture's public storage on a deployment, and the
// build / preview / port helpers of scripts/run/preview.ts bound to this package.
import type { ChildProcess } from 'node:child_process';
import { resolve } from 'node:path';
import { Fr } from '@aztec/aztec.js/fields';
import * as preview from '../../../scripts/run/preview.ts';
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

export const buildApp = (outDir: string, log: number, env: NodeJS.ProcessEnv): void =>
  preview.buildApp(pkg, outDir, log, env);

export const startPreview = (
  outDir: string,
  log: number,
  port: number,
  env: NodeJS.ProcessEnv,
): ChildProcess => preview.startPreview(pkg, outDir, log, port, env);

export const waitUntilUp = preview.waitUntilUp;

/** The stats lane (4) of this run's port window, owned by `ownerPid`. */
export const claimPreviewPort = (runId: string, ownerPid: number): Promise<number> =>
  preview.claimPreviewPort({ runId, ownerPid, worktree: resolve(pkg, '../..'), laneIndex: 4 });
