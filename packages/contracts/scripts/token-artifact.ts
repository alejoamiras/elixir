// The TXE looks up every contract a test deploys under target/, including git dependencies it
// never compiled; the aztec-standards token artifact ships in its npm package for 5.2.0.
import { copyFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const target = resolve(import.meta.dir, '..', 'target');
mkdirSync(target, { recursive: true });
copyFileSync(
  Bun.resolveSync(
    '@aztec-foundation/aztec-standards/artifacts/target/token_contract-Token.json',
    resolve(import.meta.dir, '../../deploy'),
  ),
  resolve(target, 'token_contract-Token.json'),
);
