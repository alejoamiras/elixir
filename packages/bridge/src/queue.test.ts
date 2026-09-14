import { describe, expect, test } from 'bun:test';
import { OperationQueue } from './queue.ts';

const tick = () => new Promise<void>((r) => setTimeout(r, 1));

describe('the operation queue', () => {
  test('operations run one after another, a failure does not stop the next, results go to their callers', async () => {
    const q = new OperationQueue();
    const order: string[] = [];
    const a = q.run(async () => {
      order.push('a:start');
      await tick();
      order.push('a:end');
      return 'A';
    });
    const b = q.run(async () => {
      order.push('b');
      throw new Error('b failed');
    });
    const c = q.run(async () => {
      order.push('c');
      return 'C';
    });
    expect(q.size).toBe(3);
    expect(await a).toBe('A');
    await expect(b).rejects.toThrow('b failed');
    expect(await c).toBe('C');
    expect(order).toEqual(['a:start', 'a:end', 'b', 'c']);
    await q.drain();
    expect(q.size).toBe(0);
  });
});
