// Epoch history of a deployment read straight from public storage (no wallet, no PXE), through
// the same reader the stats page uses: per epoch its target, opening time, claim count, duration,
// retarget ratio and what closed it.
//   AZTEC_NODE_URL=… bun packages/deploy/scripts/epoch-stats.ts [deployments/<profile>.json] [--json out.json]
import { resolve } from 'node:path';
import { AztecAddress } from '@aztec/aztec.js/addresses';
import { createAztecNodeClient } from '@aztec/aztec.js/node';
import { loadMinerArtifact } from '../../miner-core/src/artifacts.ts';
import { PROFILE } from '../../miner-core/src/generated/params.ts';
import { difficulty } from '../../miner-core/src/metrics.ts';
import {
  DEFAULT_LIMITS,
  type EpochRow,
  readEpochs,
  readOpenEpochNumber,
  rowsToJson,
} from '../../miner-core/src/reader.ts';
import { deriveSlotTable } from '../../miner-core/src/slots.ts';

const repo = resolve(import.meta.dir, '../../..');

/** Every epoch from 0 to the open one, oldest first; the slots are derived here, not fetched. */
export async function epochStats(nodeUrl: string, minerAddress: string): Promise<EpochRow[]> {
  const node = createAztecNodeClient(nodeUrl);
  const miner = AztecAddress.fromStringUnsafe(minerAddress);
  const layout = (await loadMinerArtifact()).storageLayout;
  const open = await readOpenEpochNumber(node, miner, layout);
  const load = (chunk: number) => deriveSlotTable(layout, chunk);
  const rows: EpochRow[] = [];
  for (let from = 0; from <= open; from += DEFAULT_LIMITS.maxEpochs) {
    const to = Math.min(open, from + DEFAULT_LIMITS.maxEpochs - 1);
    // The batches overlap by one row so every closed epoch sees its successor.
    const batch = await readEpochs(node, miner, { from, to: Math.min(open, to + 1) }, load);
    rows.push(...batch.slice(0, to - from + 1));
  }
  return rows;
}

if (import.meta.main) {
  const args = process.argv.slice(2);
  const jsonIdx = args.indexOf('--json');
  const jsonOut = jsonIdx >= 0 ? args[jsonIdx + 1] : undefined;
  const file = args.find((a) => a.endsWith('.json') && a !== jsonOut) ?? `deployments/${PROFILE}.json`;
  const deployment = (await Bun.file(resolve(repo, file)).json()) as { miner: string; nodeUrl: string };
  const nodeUrl = process.env.AZTEC_NODE_URL ?? deployment.nodeUrl;
  const rows = await epochStats(nodeUrl, deployment.miner);
  console.log('epoch  claims  opened_at (UTC)       duration  retarget  difficulty  closed by');
  for (const r of rows) {
    const opened = new Date(r.openedAt * 1000).toISOString().slice(0, 19);
    const dur = r.duration === null ? '   open' : `${String(r.duration).padStart(6)} s`;
    const rt = r.retarget === null ? '      –' : `×${r.retarget.toFixed(3)}`;
    console.log(
      `${String(r.epoch).padStart(5)}  ${String(r.claims).padStart(6)}  ${opened}  ${dur}  ${rt}  ${difficulty(r.target).toFixed(1).padStart(10)}  ${r.closedBy ?? '–'}`,
    );
  }
  if (jsonOut) await Bun.write(resolve(jsonOut), rowsToJson(rows));
}
