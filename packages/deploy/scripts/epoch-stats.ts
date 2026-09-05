// Epoch history of a deployment read straight from public storage (no wallet, no PXE):
// per epoch its target, opening time, claim count, duration and the retarget ratio.
//   AZTEC_NODE_URL=… bun packages/deploy/scripts/epoch-stats.ts [deployments/<profile>.json] [--json out.json]
import { resolve } from 'node:path';
import { loadContractArtifact } from '@aztec/aztec.js/abi';
import { AztecAddress } from '@aztec/aztec.js/addresses';
import { Fr } from '@aztec/aztec.js/fields';
import { createAztecNodeClient } from '@aztec/aztec.js/node';
import { deriveStorageSlotInMap } from '@aztec/stdlib/hash';
import { PROFILE } from '../../miner-core/src/generated/params.ts';

const repo = resolve(import.meta.dir, '../../..');

export interface EpochRow {
  epoch: number;
  target: string;
  difficulty: number;
  openedAt: number;
  claims: number;
  /** Seconds until the next epoch opened; null for the open one. */
  duration: number | null;
  /** target[e+1] / target[e]; null for the open one. */
  retarget: number | null;
}

export async function epochStats(nodeUrl: string, minerAddress: string): Promise<EpochRow[]> {
  const node = createAztecNodeClient(nodeUrl);
  const miner = AztecAddress.fromStringUnsafe(minerAddress);
  const artifact = loadContractArtifact(
    await Bun.file(resolve(repo, 'packages/contracts/target/yacana_miner-YacanaMiner.json')).json(),
  );
  const layout = artifact.storageLayout;
  const slot = (name: string) => {
    const s = layout[name]?.slot;
    if (!s) throw new Error(`no storage slot for ${name}`);
    return s;
  };
  const read = (s: Fr) => node.getPublicStorageAt('latest', miner, s);
  const open = Number((await read(slot('open_epoch'))).toBigInt());
  const rows: EpochRow[] = [];
  for (let e = 0; e <= open; e++) {
    const key = { toField: () => new Fr(e) };
    // EpochParams is packed as [target, seed, opened_at] followed by its hash.
    const base = await deriveStorageSlotInMap(slot('epochs'), key);
    const target = (await read(base)).toBigInt();
    const openedAt = Number((await read(new Fr(base.toBigInt() + 2n))).toBigInt());
    const claims = Number((await read(await deriveStorageSlotInMap(slot('claims'), key))).toBigInt());
    rows.push({
      epoch: e,
      target: `0x${target.toString(16)}`,
      difficulty: 2 ** 128 / Number(target),
      openedAt,
      claims,
      duration: null,
      retarget: null,
    });
  }
  for (let i = 0; i + 1 < rows.length; i++) {
    const [a, b] = [rows[i], rows[i + 1]] as [EpochRow, EpochRow];
    a.duration = b.openedAt - a.openedAt;
    a.retarget = Number((BigInt(b.target) * 1000n) / BigInt(a.target)) / 1000;
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
  console.log('epoch  claims  opened_at (UTC)       duration  retarget  difficulty');
  for (const r of rows) {
    const opened = new Date(r.openedAt * 1000).toISOString().slice(0, 19);
    const dur = r.duration === null ? '   open' : `${String(r.duration).padStart(6)} s`;
    const rt = r.retarget === null ? '      –' : `×${r.retarget.toFixed(3)}`;
    console.log(
      `${String(r.epoch).padStart(5)}  ${String(r.claims).padStart(6)}  ${opened}  ${dur}  ${rt}  ${r.difficulty.toFixed(1)}`,
    );
  }
  if (jsonOut) await Bun.write(resolve(jsonOut), `${JSON.stringify(rows, null, 2)}\n`);
}
