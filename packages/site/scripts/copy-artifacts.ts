// Copies the compiled artifacts a page fetches from /artifacts into <public>/artifacts.
//   bun packages/site/scripts/copy-artifacts.ts <public dir>
import { cpSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const publicDir = process.argv[2];
if (!publicDir) throw new Error('usage: copy-artifacts.ts <public dir>');
const repo = resolve(import.meta.dir, '../../..');
const out = resolve(publicDir, 'artifacts');
mkdirSync(out, { recursive: true });

const sources: Record<string, string> = {
  'yacana_miner-YacanaMiner.json': resolve(repo, 'packages/contracts/target/yacana_miner-YacanaMiner.json'),
  'yacana_work.json': resolve(repo, 'packages/work-circuit/target/yacana_work.json'),
  'token_contract-Token.json': Bun.resolveSync(
    '@aztec-foundation/aztec-standards/artifacts/target/token_contract-Token.json',
    repo,
  ),
};
for (const [name, from] of Object.entries(sources)) {
  if (!(await Bun.file(from).exists()))
    throw new Error(`${from} is missing: run bun run codegen && bun run contracts:compile`);
  cpSync(from, resolve(out, name));
}
