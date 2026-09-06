// What the page fetches besides its bundle: the slot table (generated once into miner-core's
// gitignored `generated/slots`, copied under `public/slots`) and the two storage layouts, which
// are all the page needs of the contract artifacts.
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadContractArtifact } from '@aztec/aztec.js/abi';
import { DEFAULT_OUT, generateSlots } from '../../miner-core/scripts/gen-slots.ts';
import { MINER_ARTIFACT_PATH } from '../../miner-core/src/artifacts.ts';
import { CHUNK, TABLE_EPOCHS } from '../../miner-core/src/reader.ts';

const repo = resolve(import.meta.dir, '../../..');
const publicDir = resolve(import.meta.dir, '../public');

const slots = resolve(publicDir, 'slots');
const chunks = TABLE_EPOCHS / CHUNK;
if (!existsSync(DEFAULT_OUT) || readdirSync(DEFAULT_OUT).length !== chunks) await generateSlots(DEFAULT_OUT);
rmSync(slots, { recursive: true, force: true });
mkdirSync(slots, { recursive: true });
cpSync(DEFAULT_OUT, slots, { recursive: true });

const layoutOf = async (path: string) => {
  if (!(await Bun.file(path).exists())) throw new Error(`${path} is missing: run bun run contracts:compile`);
  const { storageLayout } = loadContractArtifact(await Bun.file(path).json());
  return Object.fromEntries(Object.entries(storageLayout).map(([name, v]) => [name, v.slot.toString()]));
};
const layouts = {
  miner: await layoutOf(MINER_ARTIFACT_PATH),
  token: await layoutOf(
    Bun.resolveSync('@aztec-foundation/aztec-standards/artifacts/target/token_contract-Token.json', repo),
  ),
};
writeFileSync(resolve(publicDir, 'layouts.json'), JSON.stringify(layouts));
console.log(`slots: ${chunks} chunks and both layouts in public/`);
