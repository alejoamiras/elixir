import { describe, expect, test } from 'vitest';
import { diagnostics } from './diagnostics';

const bytes = (s: string) => new TextEncoder().encode(s).length;

describe('diagnostics export', () => {
  test('keeps the tail, shortens long hex, strips URL credentials and queries, caps line and total size', () => {
    const hash = `0x${'ab'.repeat(32)}`;
    const lines = [
      ...Array.from({ length: 250 }, (_, i) => `line ${i}`),
      `claim ${hash} sent`,
      'node https://user:secret@node.example/rpc?token=abc failed',
      'node HTTPS://user:secret@node.example/rpc?token=abc failed',
      'node https://user:secret@[::1]:8080/rpc?token=abc failed',
      `long ${'x'.repeat(1000)}`,
    ];
    const out = diagnostics(lines);
    const rows = out.split('\n');
    expect(rows).toHaveLength(200);
    expect(rows[0]).toBe('line 55');
    expect(out).toContain('claim 0xabab…abab sent');
    expect(out).not.toContain(hash);
    expect(out).toContain('node https://node.example/rpc failed');
    expect(out).toContain('node https://[::1]:8080/rpc failed');
    expect(out).not.toContain('secret');
    expect(out).not.toContain('token=abc');
    expect(bytes(rows[rows.length - 1] ?? '')).toBeLessThanOrEqual(400);
    expect(rows[rows.length - 1]?.endsWith('…')).toBe(true);
  });

  test('the total cap is 16 KB of UTF-8, not of UTF-16 units', () => {
    const wide = Array.from({ length: 200 }, () => '漢'.repeat(120));
    const out = diagnostics(wide);
    expect(bytes(out)).toBeLessThanOrEqual(16_384);
    expect(out.startsWith('…')).toBe(true);
    const narrow = Array.from({ length: 200 }, () => 'y'.repeat(399));
    expect(bytes(diagnostics(narrow))).toBeLessThanOrEqual(16_384);
  });
});
