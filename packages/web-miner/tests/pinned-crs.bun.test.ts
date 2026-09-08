import { describe, expect, test } from 'bun:test';

// Importing the interceptor wraps this realm's fetch (the guard suite does the same); nothing here fetches.
const { streamVerified } = await import('../src/pinned-crs.ts');

const hex = (buf: ArrayBuffer) =>
  Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('');
const chunks = [5, 7, 4].map((n, i) => new Uint8Array(n).fill(i + 1));
const whole = new Uint8Array(16);
chunks.reduce((at, c) => {
  whole.set(c, at);
  return at + c.length;
}, 0);
const body = () =>
  new Response(
    new ReadableStream<Uint8Array>({
      start(controller) {
        for (const c of chunks) controller.enqueue(c);
        controller.close();
      },
    }),
  );

describe('the streamed CRS load', () => {
  test('bytes are reported as they land and total the pin; the whole matches it', async () => {
    const sha256 = hex(await crypto.subtle.digest('SHA-256', whole));
    const seen: number[] = [];
    const out = await streamVerified(body(), { bytes: 16, sha256 }, 'g1', (n) => seen.push(n));
    expect(seen).toEqual([5, 7, 4]);
    expect(Array.from(out)).toEqual(Array.from(whole));
  });

  test('a wrong hash still throws, after every byte was streamed and counted', async () => {
    const seen: number[] = [];
    await expect(
      streamVerified(body(), { bytes: 16, sha256: '00'.repeat(32) }, 'g1', (n) => seen.push(n)),
    ).rejects.toThrow(/does not match its pin/);
    expect(seen.reduce((a, b) => a + b, 0)).toBe(16);
  });

  test('a body longer than its pin is refused as it streams, never buffered whole', async () => {
    await expect(streamVerified(body(), { bytes: 10, sha256: 'x' }, 'g1', () => {})).rejects.toThrow(
      /longer than its pin/,
    );
  });
});
