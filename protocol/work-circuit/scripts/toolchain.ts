// Pinned toolchain paths. `.aztecrc` names the aztec version; `~/.aztec/current` is a machine-global
// symlink any agent may move and `PATH` is whatever the caller's shell had, so bb and aztec-nargo
// are resolved from the pinned version directory directly.
import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';

export const repoRoot = resolve(import.meta.dir, '../../..');
export const workCircuitRoot = resolve(import.meta.dir, '..');

const pin = readFileSync(join(repoRoot, '.aztecrc'), 'utf8').trim();
const version = join(homedir(), '.aztec', 'versions', pin);
const pinnedBb = join(version, 'node_modules', '.bin', 'bb');
const pinnedNargo = join(version, 'bin', 'aztec-nargo');
for (const bin of [pinnedBb, pinnedNargo])
  if (!existsSync(bin))
    throw new Error(`aztec ${pin} is not installed (${bin} missing); run VERSION=${pin} aztec-up`);

export const AZTEC_VERSION = pin;
export const BB = pinnedBb;
export const AZTEC_NARGO = pinnedNargo;
