// The artifacts the pages fetch, committed so a Cloudflare build needs only Bun: the `target/`
// output with `file_map` and `debug_symbols` emptied (absolute source paths: neither reproducible
// nor fit to publish). CI re-runs `bun run artifacts:commit` and diffs.
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const repo = resolve(import.meta.dir, '../../..');

export const COMMITTED = {
  miner: resolve(repo, 'packages/contracts/artifacts/yacana_miner-YacanaMiner.json'),
  work: resolve(repo, 'packages/work-circuit/artifacts/yacana_work.json'),
};

const COMPILED = {
  miner: resolve(repo, 'packages/contracts/target/yacana_miner-YacanaMiner.json'),
  work: resolve(repo, 'packages/work-circuit/target/yacana_work.json'),
};

type Json = Record<string, unknown>;

/**
 * The artifact with what only a debugger reads emptied, not removed: aztec.js's loader requires
 * `file_map` (a record) and every function's `debug_symbols` (a string) to be present.
 */
export function stripDebug(artifact: Json): Json {
  const out: Json = { ...artifact };
  if ('file_map' in out) out.file_map = {};
  if ('debug_symbols' in out) out.debug_symbols = '';
  if (Array.isArray(out.functions))
    out.functions = out.functions.map((f: Json) => ('debug_symbols' in f ? { ...f, debug_symbols: '' } : f));
  return out;
}

export async function commitArtifacts(): Promise<string[]> {
  const written: string[] = [];
  for (const key of ['miner', 'work'] as const) {
    const from = Bun.file(COMPILED[key]);
    if (!(await from.exists()))
      throw new Error(`${COMPILED[key]} is missing: run bun run codegen && bun run contracts:compile`);
    mkdirSync(resolve(COMMITTED[key], '..'), { recursive: true });
    await Bun.write(COMMITTED[key], JSON.stringify(stripDebug((await from.json()) as Json)));
    written.push(COMMITTED[key]);
  }
  return written;
}

if (import.meta.main) for (const f of await commitArtifacts()) console.log(`artifacts:commit ${f}`);
