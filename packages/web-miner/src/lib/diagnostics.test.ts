import { describe, expect, test } from 'vitest';
import { diagnostics } from './diagnostics';

describe('diagnostics export', () => {
  test('keeps the tail, shortens long hex, strips URL credentials and queries, caps line and total size', () => {
    const hash = `0x${'ab'.repeat(32)}`;
    const lines = [
      ...Array.from({ length: 250 }, (_, i) => `line ${i}`),
      `claim ${hash} sent`,
      'node https://user:secret@node.example/rpc?token=abc failed',
      `long ${'x'.repeat(1000)}`,
    ];
    const out = diagnostics(lines);
    const rows = out.split('\n');
    expect(rows).toHaveLength(200);
    expect(rows[0]).toBe('line 53');
    expect(out).toContain('claim 0xabab…abab sent');
    expect(out).not.toContain(hash);
    expect(out).toContain('node https://node.example/rpc failed');
    expect(out).not.toContain('secret');
    expect(out).not.toContain('token=abc');
    expect(rows[rows.length - 1]?.length).toBeLessThanOrEqual(401);
    expect(diagnostics(Array.from({ length: 200 }, () => 'y'.repeat(399))).length).toBeLessThanOrEqual(
      16_385,
    );
  });
});
