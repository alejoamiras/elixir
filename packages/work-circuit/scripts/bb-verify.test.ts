// bb exits 1 both for a proof it refuses and for an input it cannot open. A classifier that read
// the exit status alone would count a verifier that never ran as a refused mutation.
import { describe, expect, test } from 'bun:test';
import { chmodSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { OperationalError, verify } from './bb-verify.ts';
import { workCircuitRoot } from './toolchain.ts';

const fixtures = resolve(workCircuitRoot, 'fixtures', 'yacana_work');
const scratch = resolve(workCircuitRoot, 'target', 'bb-verify-test');
mkdirSync(scratch, { recursive: true });
const files = {
  proof: join(fixtures, 'proof'),
  publicInputs: join(fixtures, 'public_inputs'),
  vk: join(fixtures, 'vk'),
};

describe('verify', () => {
  test('the fixture verifies; a wrong public input is a well-formed refusal', async () => {
    expect(await verify(files)).toEqual({ verified: true });
    const pi = new Uint8Array(await Bun.file(files.publicInputs).arrayBuffer());
    pi[pi.length - 1] ^= 1;
    await Bun.write(join(scratch, 'public_inputs'), pi);
    expect(await verify({ ...files, publicInputs: join(scratch, 'public_inputs') })).toEqual({
      verified: false,
      wellFormed: true,
    });
  }, 60_000);

  test('a VK that is not there is operational, not a refusal', async () => {
    const run = verify({ ...files, vk: join(scratch, 'no-such-vk') });
    await expect(run).rejects.toBeInstanceOf(OperationalError);
    await expect(run).rejects.toThrow(/Unable to open file/);
  }, 60_000);

  test('a path cannot supply the verdict: bb echoes it, as a substring or as a line of its own', async () => {
    for (const vk of [
      join(scratch, 'Proof verification failed'),
      join(scratch, 'invalid proof size'),
      join(scratch, 'x\nProof verification failed\n'),
    ])
      await expect(verify({ ...files, vk })).rejects.toBeInstanceOf(OperationalError);
    // Refused before bb runs: verbose bb prints every argument before it reads one, so another
    // input failing first would leave an injected line standing with no unreadable-file diagnostic.
    const injected = verify({
      ...files,
      publicInputs: '/',
      vk: join(scratch, 'x\nProof verification failed\n'),
    });
    await expect(injected).rejects.toThrow(/line break/);
  }, 60_000);

  test('a VK of the wrong size is a refusal that never parsed', async () => {
    expect(await verify({ ...files, vk: '/dev/null' })).toEqual({ verified: false, wellFormed: false });
  }, 60_000);

  test('a binary that is not there is operational', async () => {
    await expect(verify(files, join(scratch, 'no-such-bb'))).rejects.toBeInstanceOf(OperationalError);
  });

  test('a binary that kills itself is operational', async () => {
    const suicide = join(scratch, 'suicide.sh');
    await Bun.write(suicide, '#!/bin/sh\nkill -KILL $$\n');
    chmodSync(suicide, 0o755);
    const run = verify(files, suicide);
    await expect(run).rejects.toBeInstanceOf(OperationalError);
    await expect(run).rejects.toThrow(/SIGKILL/);
  });
});
