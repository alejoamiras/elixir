import { describe, expect, test } from 'bun:test';
import type { Tx } from '@aztec/stdlib/tx';
import { type SentTx, sendObserver } from '../src/wallet.ts';

const tx = (hash: string, expiresAt: number, anchorBlock: number): Tx =>
  ({
    getTxHash: () => ({ toString: () => hash }),
    data: {
      expirationTimestamp: BigInt(expiresAt),
      constants: { anchorBlockHeader: { globalVariables: { blockNumber: anchorBlock } } },
    },
  }) as unknown as Tx;

describe('the send observer', () => {
  test('every send is observed; a hook runs before the node sees that one send alone, and a refusal stops it', async () => {
    const seen: SentTx[] = [];
    const order: string[] = [];
    const o = sendObserver((s) => seen.push(s));
    const target = { sendTx: async () => void order.push('node') };
    // No hook: straight through, and the observation is synchronous.
    await o.sendTx(target, tx('0xa', 100, 7));
    expect(seen).toEqual([{ txHash: '0xa', expiresAt: 100, anchorBlock: 7 }]);
    // A hook: committed before the node, then gone.
    o.beforeNextSend(async (s) => {
      order.push(`hook ${s.txHash}`);
    });
    await o.sendTx(target, tx('0xb', 200, 8));
    await o.sendTx(target, tx('0xc', 300, 9));
    expect(order).toEqual(['node', 'hook 0xb', 'node', 'node']);
    // A hook that fails refuses the send: nothing reaches the node.
    o.beforeNextSend(async () => {
      throw new Error('storage failed');
    });
    await expect(o.sendTx(target, tx('0xd', 400, 10))).rejects.toThrow('storage failed');
    expect(order).toHaveLength(4);
    // A hook removed before its send never runs; removing a superseded hook leaves the newer one.
    const remove = o.beforeNextSend(async () => void order.push('stale'));
    remove();
    await o.sendTx(target, tx('0xe', 500, 11));
    const first = o.beforeNextSend(async () => void order.push('first'));
    o.beforeNextSend(async () => void order.push('second'));
    first();
    await o.sendTx(target, tx('0xf', 600, 12));
    expect(order.slice(4)).toEqual(['node', 'second', 'node']);
  });
});
