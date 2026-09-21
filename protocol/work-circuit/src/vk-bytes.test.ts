import { describe, expect, test } from 'bun:test';
import { resolve } from 'node:path';
import { W_VK, W_VK_BYTES } from './generated/vk.ts';

describe('W_VK_BYTES', () => {
  test('is the committed binary VK, byte for byte, and the fields concatenated', async () => {
    const fixture = new Uint8Array(
      await Bun.file(resolve(import.meta.dir, '..', 'fixtures', 'yacana_work', 'vk')).arrayBuffer(),
    );
    expect(W_VK_BYTES.length).toBe(115 * 32);
    expect(Buffer.from(W_VK_BYTES).equals(Buffer.from(fixture))).toBe(true);
    expect(Buffer.from(W_VK_BYTES).toString('hex')).toBe(W_VK.map((f) => f.slice(2)).join(''));
  });
});
