import 'fake-indexeddb/auto';
import { describe, expect, test } from 'bun:test';
import lock from '../../site/crs.lock.json';

// The fetch behind `/crs/<name>`: every request is answered here, counted with its range header.
// `g2` (128 bytes) streams a full body of the wrong bytes and then breaks; the others fail a moment
// later, so the run's first failure is g2's.
const requests: { name: string; range: string | null }[] = [];
const crsFetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const href = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  const name = href.slice(href.lastIndexOf('/') + 1);
  requests.push({ name, range: new Headers(init?.headers).get('range') });
  if (name !== 'g2.dat') {
    await new Promise((r) => setTimeout(r, 30));
    throw new TypeError('Failed to fetch');
  }
  return new Response(
    new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array(lock.files['g2.dat'].bytes).fill(9));
      },
      // After the chunk was read (an error in `start` would discard it unread).
      pull(controller) {
        controller.error(new TypeError('network error'));
      },
    }),
  );
}) as typeof globalThis.fetch;
// Importing the interceptor wraps this realm's fetch (the guard suite does the same).
const { setCrsFetchForTests, startCrs, streamVerified } = await import('../src/pinned-crs.ts');
setCrsFetchForTests(crsFetch);

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
  test('a buffer that filled before the stream broke is checked, never asked for again', async () => {
    await expect(startCrs()).rejects.toThrow(/network error/);
    // The retry: the broken files are asked for again from the start, the full one is not asked for
    // at all — its bytes are checked against the pin, and refused (the fill is not the CRS).
    await expect(startCrs()).rejects.toThrow(/g2.dat does not match its pin/);
    const g2 = requests.filter((r) => r.name === 'g2.dat');
    expect(g2).toEqual([{ name: 'g2.dat', range: null }]);
    expect(requests.filter((r) => r.name !== 'g2.dat').every((r) => r.range === null)).toBe(true);
  });

  test('a 206 continues an interrupted buffer where it stopped; a full answer starts it over', async () => {
    const sha256 = hex(await crypto.subtle.digest('SHA-256', whole));
    const rest = (status: number, headers: Record<string, string>) =>
      new Response(
        new ReadableStream<Uint8Array>({
          start(controller) {
            for (const c of chunks.slice(1)) controller.enqueue(c);
            controller.close();
          },
        }),
        { status, headers },
      );
    const partial = { out: new Uint8Array(16), at: 5 };
    partial.out.set(chunks[0] as Uint8Array, 0);
    const seen: number[] = [];
    const out = await streamVerified(
      rest(206, { 'content-range': 'bytes 5-15/16' }),
      { bytes: 16, sha256 },
      'g1',
      (n) => seen.push(n),
      { ...partial },
    );
    expect(seen).toEqual([7, 4]);
    expect(Array.from(out)).toEqual(Array.from(whole));
    // The server ignored the range: the five bytes leave the count and the body is the whole file again.
    const over: number[] = [];
    await expect(
      streamVerified(body(), { bytes: 16, sha256 }, 'g1', (n) => over.push(n), { ...partial }),
    ).resolves.toBeTruthy();
    expect(over).toEqual([-5, 5, 7, 4]);
  });

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
