// The proving toolchain is part of the trusted computing base: the native bb binary, the bb.js
// WASM and the Noir dependencies fetched by git tag are pinned to content hashes / commits in
// toolchain.lock.json, and any drift (a moved tag, a re-published binary) fails here.
import { describe, expect, test } from 'bun:test';
import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import lock from '../../toolchain.lock.json';

const pin = readFileSync(resolve(import.meta.dir, '../../.aztecrc'), 'utf8').trim();
const versionDir = join(homedir(), '.aztec', 'versions', pin);
const bbjs = join(versionDir, 'node_modules', '@aztec', 'bb.js');
const sha256 = (path: string) => new Bun.CryptoHasher('sha256').update(readFileSync(path)).digest('hex');

// Locally the toolchain may be absent; in CI it is installed before this runs and must be checked.
describe.skipIf(!existsSync(versionDir) && !process.env.CI)('pinned toolchain', () => {
  test('.aztecrc and the lock agree', () => expect(pin).toBe(lock.aztec));

  test('native bb binary matches its hash', () => {
    const key = `${process.platform}-${process.arch}` as keyof typeof lock.bb;
    const expected = lock.bb[key];
    if (!expected) return; // only the platforms we ship hashes for
    const bin = join(bbjs, 'build', key === 'linux-x64' ? 'amd64-linux' : key, 'bb');
    expect(sha256(bin)).toBe(expected);
  });

  test('bb.js WASM matches its hash', () => {
    for (const [file, hash] of Object.entries(lock.bbjs)) expect(sha256(join(bbjs, file))).toBe(hash);
  });

  test('Noir git dependencies sit at their pinned commits', () => {
    for (const [dep, commit] of Object.entries(lock.nargo)) {
      const head = join(homedir(), 'nargo', 'github.com', dep, '.git', 'HEAD');
      if (!existsSync(head)) continue; // not fetched by this workflow's compile
      expect(readFileSync(head, 'utf8').trim()).toBe(commit);
    }
  });
});
