// The VK is the puzzle: the verifier circuit must hard-wire every VK field and the key hash as
// constants so no other VK can satisfy it. Checked on the compiled ACIR, not by convention.
import { describe, expect, test } from 'bun:test';
import { resolve } from 'node:path';
import { $ } from 'bun';
import { W_VK, W_VK_HASH } from './generated/vk.ts';

const root = resolve(import.meta.dir, '..');

describe('verify_w ACIR', () => {
  test('pins every VK field and the key hash as constants', async () => {
    const acir = (await $`aztec-nargo compile --package verify_w --print-acir`.cwd(root).text()).split('\n');
    const pinned = new Map<string, bigint>();
    for (const line of acir) {
      const m = line.match(/^ASSERT (w\d+) = (\d+)$/);
      if (m?.[1] && m[2]) pinned.set(m[1], BigInt(m[2]));
    }
    const agg = acir.filter((l) => l.startsWith('BLACKBOX::RECURSIVE_AGGREGATION'));
    expect(agg).toHaveLength(1);
    const call = agg[0] ?? '';
    const vkWitnesses = call.match(/verification_key: \[([^\]]+)\]/)?.[1]?.split(', ') ?? [];
    const keyHash = call.match(/key_hash: (w\d+)/)?.[1] ?? '';
    expect(vkWitnesses).toHaveLength(115);
    for (const [i, w] of vkWitnesses.entries()) expect(pinned.get(w)).toBe(BigInt(W_VK[i] ?? ''));
    expect(pinned.get(keyHash)).toBe(BigInt(W_VK_HASH));
    // Nothing else is in the circuit: no witness path could bypass the pinned verification.
    const opcodes = acir.filter((l) => /^[A-Z]/.test(l) && !l.startsWith('ASSERT'));
    expect(opcodes.map((l) => l.split(' ')[0])).toEqual(['Compiled', 'BLACKBOX::RECURSIVE_AGGREGATION']);
  }, 120_000);
});
