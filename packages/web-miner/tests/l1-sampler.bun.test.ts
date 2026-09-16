// bun: the L1 sampler against a fake viem client — a matching chain's reading lands in the health
// store, another chain's is dropped, a failure is logged and the next tick tries again.
import { beforeEach, describe, expect, test } from 'bun:test';
import type { ethRpcClient } from '../../site/src/browser/eth-rpc.ts';
import { nodeHealth, resetNodeHealth } from '../../site/src/browser/node-health.ts';
import { startL1Sampler } from '../src/l1-sampler.ts';

type Client = ReturnType<typeof ethRpcClient>;

const fakeClient = (o: { chainId: bigint; head: bigint; pending: bigint | Error }) =>
  ({
    getChainId: async () => Number(o.chainId),
    getBlockNumber: async () => o.head,
    readContract: async () => {
      if (o.pending instanceof Error) throw o.pending;
      return o.pending;
    },
  }) as unknown as Client;

describe('the L1 sampler', () => {
  beforeEach(resetNodeHealth);

  test('a reading from the record’s chain lands; the client follows the RPC in use', async () => {
    const made: string[] = [];
    let url = 'https://a.example';
    const s = startL1Sampler({
      rpcUrl: () => url,
      rollup: '0x1',
      chainId: 31337n,
      intervalMs: 3_600_000,
      make: (u) => {
        made.push(u);
        return fakeClient({ chainId: 31337n, head: 100n + BigInt(made.length), pending: 42n });
      },
    });
    await s.tick();
    expect(nodeHealth().l1).toMatchObject({ pendingCheckpoint: 42, head: 101 });
    url = 'https://b.example';
    await s.tick();
    expect(made).toEqual(['https://a.example', 'https://b.example']);
    expect(nodeHealth().l1?.head).toBe(102);
    s.stop();
  });

  test('another chain’s rollup is dropped; a failing read is logged and does not poison the store', async () => {
    const lines: string[] = [];
    const s = startL1Sampler({
      rpcUrl: () => 'https://a.example',
      rollup: '0x1',
      chainId: 31337n,
      intervalMs: 3_600_000,
      make: () => fakeClient({ chainId: 1n, head: 5n, pending: 9n }),
      log: (l) => lines.push(l),
    });
    await s.tick();
    expect(nodeHealth().l1).toBeNull();
    s.stop();
    const failing = startL1Sampler({
      rpcUrl: () => 'https://a.example',
      rollup: '0x1',
      chainId: 31337n,
      intervalMs: 3_600_000,
      make: () => fakeClient({ chainId: 31337n, head: 5n, pending: new Error('no answer') }),
      log: (l) => lines.push(l),
    });
    await failing.tick();
    expect(lines).toEqual(['L1 sample: no answer']);
    expect(nodeHealth().l1).toBeNull();
    failing.stop();
  });

  test('an answer from an RPC no longer in use, or after stop, is dropped', async () => {
    let url = 'https://a.example';
    let release: (() => void) | undefined;
    const slow = {
      getChainId: async () => 31337,
      getBlockNumber: async () => 100n,
      readContract: () =>
        new Promise<bigint>((r) => {
          release = () => r(42n);
        }),
    } as unknown as Client;
    const s = startL1Sampler({
      rpcUrl: () => url,
      rollup: '0x1',
      chainId: 31337n,
      intervalMs: 3_600_000,
      make: () => slow,
    });
    const first = s.tick();
    url = 'https://b.example';
    release?.();
    await first;
    expect(nodeHealth().l1).toBeNull();
    const second = s.tick();
    s.stop();
    release?.();
    await second;
    expect(nodeHealth().l1).toBeNull();
  });
});
