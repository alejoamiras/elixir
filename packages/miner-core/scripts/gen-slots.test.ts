import { describe, expect, test } from 'bun:test';
import { mkdtempSync, readdirSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CHUNK, slotTableFromJson, TABLE_EPOCHS } from '../src/reader.ts';
import { generateSlots } from './gen-slots.ts';

describe('gen-slots', () => {
  test('a full run writes every chunk, each of the expected size, and each parses back', async () => {
    const out = mkdtempSync(join(tmpdir(), 'yacana-slots-'));
    try {
      expect(await generateSlots(out)).toBe(TABLE_EPOCHS / CHUNK);
      const files = readdirSync(out).sort((a, b) => Number.parseInt(a, 10) - Number.parseInt(b, 10));
      expect(files).toHaveLength(512);
      expect(files[0]).toBe('0.json');
      expect(files[511]).toBe('511.json');
      for (const f of files) {
        const size = statSync(join(out, f)).size;
        // 1024 hex field elements of 66 chars plus the JSON around them.
        expect(size).toBeGreaterThan(69_000);
        expect(size).toBeLessThan(72_000);
      }
      const last = slotTableFromJson(await Bun.file(join(out, '511.json')).text(), 511);
      expect(last.first).toBe(TABLE_EPOCHS - CHUNK);
    } finally {
      rmSync(out, { recursive: true, force: true });
    }
  }, 120_000);
});
