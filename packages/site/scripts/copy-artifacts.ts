// Copies the artifacts a page fetches from /artifacts into <public>/artifacts: the committed miner
// and work-circuit artifacts (`bun run artifacts:commit`) and the token's from aztec-standards.
//   bun packages/site/scripts/copy-artifacts.ts <public dir>
import { cpSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { COMMITTED } from './commit-artifacts.ts';

const repo = resolve(import.meta.dir, '../../..');

const sources: Record<string, string> = {
  'yacana_miner-YacanaMiner.json': COMMITTED.miner,
  'yacana_work.json': COMMITTED.work,
  'token_contract-Token.json': Bun.resolveSync(
    '@aztec-foundation/aztec-standards/artifacts/target/token_contract-Token.json',
    repo,
  ),
};

export async function copyArtifacts(publicDir: string): Promise<void> {
  const out = resolve(publicDir, 'artifacts');
  mkdirSync(out, { recursive: true });
  for (const [name, from] of Object.entries(sources)) {
    if (!(await Bun.file(from).exists()))
      throw new Error(
        `${from} is missing: run bun run codegen && bun run contracts:compile && bun run artifacts:commit`,
      );
    cpSync(from, resolve(out, name));
  }
}

if (import.meta.main) {
  const publicDir = process.argv[2];
  if (!publicDir) throw new Error('usage: copy-artifacts.ts <public dir>');
  await copyArtifacts(resolve(publicDir));
}
