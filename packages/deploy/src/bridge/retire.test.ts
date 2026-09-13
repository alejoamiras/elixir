import { describe, expect, mock, test } from 'bun:test';
import type { L2Side } from './l2.ts';
import type { Operator } from './operator.ts';
import { LOG_WINDOW, retireOnL1, retireOnL2 } from './retire.ts';

/** A portal that says version 7 is retired, on an RPC that logged the send 25,000 blocks after the deploy. */
const operatorWithRetiredLog = (deployBlock: bigint, head: bigint, logAt: bigint) => {
  const ranges: [bigint, bigint][] = [];
  const op = {
    record: { bridge: { deployBlock: deployBlock.toString() } },
    registry: { read: { numberOfVersions: async () => 1n } },
    portal: {
      address: '0x000000000000000000000000000000000000beef',
      read: {
        flipAt: async () => 1n,
        versionInfo: async () => ({ retireSent: true }),
        transitions: async () => 1n,
      },
    },
    publicClient: {
      getBlockNumber: async () => head,
      getContractEvents: async ({ fromBlock, toBlock }: { fromBlock: bigint; toBlock: bigint }) => {
        ranges.push([fromBlock, toBlock]);
        return logAt >= fromBlock && logAt <= toBlock
          ? [{ transactionHash: '0xabc', args: { version: 7n, inboxIndex: 41n } }]
          : [];
      },
    },
  } as unknown as Operator;
  return { op, ranges };
};

describe('retire', () => {
  test('a retire sent before is found again in bounded log windows from the deploy block', async () => {
    const { op, ranges } = operatorWithRetiredLog(1_000n, 40_000n, 26_000n);
    expect(await retireOnL1(op, 7n)).toEqual({
      version: 7n,
      txHash: '0xabc',
      inboxIndex: 41n,
      resumed: true,
    });
    expect(ranges).toEqual([
      [1_000n, 1_000n + LOG_WINDOW - 1n],
      [1_000n + LOG_WINDOW, 1_000n + 2n * LOG_WINDOW - 1n],
      [1_000n + 2n * LOG_WINDOW, 1_000n + 3n * LOG_WINDOW - 1n],
    ]);
    for (const [from, to] of ranges) expect(to - from + 1n).toBeLessThanOrEqual(LOG_WINDOW);
  });

  test('a retired version with no log in range is an error, not a silent resend', async () => {
    const { op } = operatorWithRetiredLog(0n, 5n, 99n);
    await expect(retireOnL1(op, 7n)).rejects.toThrow(/no Retired log/);
  });

  test('the L2 step checks the node it is on, not the record it was opened with', async () => {
    const retire = mock(() => ({ send: async () => ({ receipt: { txHash: '0x1' } }) }));
    const l2 = {
      node: { getNodeInfo: async () => ({ rollupVersion: 8 }) },
      rollupVersion: 7n,
      chainId: 31337n,
      miner: { address: { toString: () => `0x${'11'.repeat(32)}` }, methods: { retire } },
    } as unknown as L2Side;
    await expect(
      retireOnL2(l2, '0x000000000000000000000000000000000000beef', { version: 7n, inboxIndex: 1n }),
    ).rejects.toThrow(/serves version 8; the retire was for 7/);
    expect(retire).not.toHaveBeenCalled();
  });
});
