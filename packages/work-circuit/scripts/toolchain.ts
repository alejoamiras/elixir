// Pinned toolchain paths. `.aztecrc` names the aztec version; `~/.aztec/current` is a machine-global
// symlink any agent may move, so bb is resolved from the pinned version directory directly.
import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';

export const repoRoot = resolve(import.meta.dir, '../../..');
export const workCircuitRoot = resolve(import.meta.dir, '..');

const pin = readFileSync(join(repoRoot, '.aztecrc'), 'utf8').trim();
const pinnedBb = join(homedir(), '.aztec', 'versions', pin, 'node_modules', '.bin', 'bb');
if (!existsSync(pinnedBb))
  throw new Error(`aztec ${pin} is not installed (${pinnedBb} missing); run VERSION=${pin} aztec-up`);

export const AZTEC_VERSION = pin;
export const BB = pinnedBb;
