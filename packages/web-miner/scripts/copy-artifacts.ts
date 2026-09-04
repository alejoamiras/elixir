// The page fetches compiled artifacts (build outputs of the sibling packages) from /artifacts.
import { cpSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const pkg = resolve(import.meta.dir, '..');
const repo = resolve(pkg, '../..');
const out = resolve(pkg, 'public/artifacts');
mkdirSync(out, { recursive: true });

const sources: Record<string, string> = {
  'elixir_miner-ElixirMiner.json': resolve(repo, 'packages/contracts/target/elixir_miner-ElixirMiner.json'),
  'elixir_work.json': resolve(repo, 'packages/work-circuit/target/elixir_work.json'),
  'token_contract-Token.json': Bun.resolveSync(
    '@aztec-foundation/aztec-standards/artifacts/target/token_contract-Token.json',
    pkg,
  ),
};
for (const [name, from] of Object.entries(sources)) {
  if (!(await Bun.file(from).exists()))
    throw new Error(`${from} is missing: run bun run codegen && bun run contracts:compile`);
  cpSync(from, resolve(out, name));
}
