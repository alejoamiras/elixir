// The proving toolchain is part of the trusted computing base: the native bb and nargo binaries,
// the bb.js WASM and the Noir dependencies fetched by git tag are pinned to content hashes /
// commits in toolchain.lock.json, and any drift (a moved tag, a re-published binary) fails here.
import { describe, expect, test } from 'bun:test';
import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import lock from '../../toolchain.lock.json';

const pin = readFileSync(resolve(import.meta.dir, '../../.aztecrc'), 'utf8').trim();
const versionDir = join(homedir(), '.aztec', 'versions', pin);
const sha256 = (path: string) => new Bun.CryptoHasher('sha256').update(readFileSync(path)).digest('hex');

// Skipped where the toolchain is absent unless a workflow that installed it demands the check.
describe.skipIf(!existsSync(versionDir) && !process.env.ELIXIR_REQUIRE_TOOLCHAIN)('pinned toolchain', () => {
  test('.aztecrc and the lock agree', () => expect(pin).toBe(lock.aztec));

  test('native binaries match their hashes', () => {
    const platform = lock.binaries[`${process.platform}-${process.arch}` as keyof typeof lock.binaries];
    if (!platform) return; // only the platforms we ship hashes for
    for (const [file, hash] of Object.entries(platform)) expect(sha256(join(versionDir, file))).toBe(hash);
  });

  test('bb.js WASM matches its hash', () => {
    for (const [file, hash] of Object.entries(lock.bbjs)) {
      expect(sha256(join(versionDir, 'node_modules', '@aztec', 'bb.js', file))).toBe(hash);
    }
  });

  test('Noir git dependencies sit at their pinned commits', () => {
    for (const [dep, commit] of Object.entries(lock.nargo)) {
      const head = join(homedir(), 'nargo', 'github.com', dep, '.git', 'HEAD');
      if (!existsSync(head)) continue; // not fetched by this workflow's compile
      expect(readFileSync(head, 'utf8').trim()).toBe(commit);
    }
  });
});
