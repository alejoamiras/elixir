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
    expect(run).rejects.toBeInstanceOf(OperationalError);
    expect(run).rejects.toThrow(/Unable to open file/);
  }, 60_000);

  test('a binary that is not there is operational', async () => {
    expect(verify(files, join(scratch, 'no-such-bb'))).rejects.toBeInstanceOf(OperationalError);
  });

  test('a binary that kills itself is operational', async () => {
    const suicide = join(scratch, 'suicide.sh');
    await Bun.write(suicide, '#!/bin/sh\nkill -KILL $$\n');
    chmodSync(suicide, 0o755);
    const run = verify(files, suicide);
    expect(run).rejects.toBeInstanceOf(OperationalError);
    expect(run).rejects.toThrow(/SIGKILL/);
  });
});
