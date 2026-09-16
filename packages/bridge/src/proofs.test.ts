// The unit cases run on a fake client; the live one under `bun run e2e:agent -- bun test packages/bridge`
// reads the isolated network's own Rollup through its anvil.
import { describe, expect, test } from 'bun:test';
import { resolve } from 'node:path';
import { createAztecNodeClient } from '@aztec/aztec.js/node';
import { RollupAbi } from '@aztec/l1-artifacts/RollupAbi';
import { createAztecNodeDebugClient } from '@aztec/stdlib/interfaces/client';
import { createPublicClient, decodeEventLog, type Hex, http } from 'viem';
import { LOG_WINDOW } from './logs.ts';
import { type ProofClient, proofReader } from './proofs.ts';

const ROLLUP = `0x${'ab'.repeat(20)}` as Hex;
/** One `L2ProofVerified` log as anvil served it on an isolated network (`YACANA_RECORD_PROOF_LOG=1` below). */
const recorded = (await Bun.file(resolve(import.meta.dir, '../fixtures/l2-proof-verified.json')).json()) as {
  blockNumber: number;
  logIndex: number;
  topics: Hex[];
  data: Hex;
};

type FakeLog = { blockNumber: bigint; logIndex: number; args: { checkpointNumber: bigint; proverId: Hex } };

/** A chain of `head` blocks whose timestamp is ten times the number, with proof events at the given blocks. */
const chain = (head: bigint, events: FakeLog[]) => {
  const calls: [bigint, bigint][] = [];
  const client = {
    getBlockNumber: async () => head,
    getBlock: async ({ blockNumber }: { blockNumber?: bigint }) => ({ timestamp: (blockNumber ?? 0n) * 10n }),
    getContractEvents: async ({ fromBlock, toBlock }: { fromBlock?: bigint; toBlock?: bigint }) => {
      calls.push([fromBlock ?? 0n, toBlock ?? 0n]);
      return events.filter((e) => e.blockNumber >= (fromBlock ?? 0n) && e.blockNumber <= (toBlock ?? 0n));
    },
  } as unknown as ProofClient;
  return { client, calls, events };
};
const event = (blockNumber: bigint, checkpointNumber: bigint, logIndex = 0): FakeLog => ({
  blockNumber,
  logIndex,
  args: { checkpointNumber, proverId: `0x${'01'.repeat(20)}` },
});

describe("the rollup's latest proof on Ethereum", () => {
  test('a recorded L2ProofVerified log decodes to its checkpoint; the reader answers with its block time', async () => {
    const decoded = decodeEventLog({
      abi: RollupAbi,
      data: recorded.data as Hex,
      topics: recorded.topics as [Hex, ...Hex[]],
    });
    expect(decoded.eventName).toBe('L2ProofVerified');
    const checkpoint = (decoded.args as { checkpointNumber: bigint }).checkpointNumber;
    const c = chain(BigInt(recorded.blockNumber) + 3n, [
      {
        blockNumber: BigInt(recorded.blockNumber),
        logIndex: recorded.logIndex,
        args: decoded.args as FakeLog['args'],
      },
    ]);
    const read = await proofReader(c.client, { rollup: ROLLUP, floor: async () => 0n }).latestProvenAt();
    expect(read).toEqual({
      at: BigInt(recorded.blockNumber) * 10n,
      checkpoint,
      block: BigInt(recorded.blockNumber),
    });
  });

  test('the newest event wins, not the first found; the floor reached without one is "none"', async () => {
    const c = chain(25_000n, [event(100n, 1n), event(20_100n, 7n), event(20_100n, 8n, 1), event(3_000n, 2n)]);
    const reader = proofReader(c.client, { rollup: ROLLUP, floor: async () => 0n, budget: 8 });
    expect(await reader.latestProvenAt()).toEqual({ at: 201_000n, checkpoint: 8n, block: 20_100n });
    // Newest-first: the first window read is the head's.
    expect(c.calls[0]).toEqual([25_000n - LOG_WINDOW + 1n, 25_000n]);
    const empty = chain(25_000n, []);
    expect(
      await proofReader(empty.client, { rollup: ROLLUP, floor: async () => 1_000n }).latestProvenAt(),
    ).toBe('none');
    expect(empty.calls.at(-1)?.[0]).toBe(1_000n);
  });

  test('a budget exhausted is unknown, and the next call resumes below the last window', async () => {
    const c = chain(45_000n, [event(50n, 1n)]);
    const reader = proofReader(c.client, { rollup: ROLLUP, floor: async () => 0n, budget: 2 });
    expect(await reader.latestProvenAt()).toBe('unknown');
    expect(c.calls).toHaveLength(2);
    expect(await reader.latestProvenAt()).toBe('unknown');
    expect(c.calls[2]?.[1]).toBe(45_000n - 2n * LOG_WINDOW);
    expect(await reader.latestProvenAt()).toEqual({ at: 500n, checkpoint: 1n, block: 50n });
  });

  test('a known event is advanced over the overlap: a newer one replaces it, its disappearance is a reorg', async () => {
    const c = chain(1_000n, [event(900n, 4n)]);
    const reader = proofReader(c.client, { rollup: ROLLUP, floor: async () => 0n, overlap: 5n });
    expect(await reader.latestProvenAt()).toMatchObject({ checkpoint: 4n });
    c.events.push(event(950n, 5n));
    expect(await reader.latestProvenAt()).toMatchObject({ checkpoint: 5n, at: 9_500n });
    expect(c.calls.at(-1)).toEqual([895n, 1_000n]);
    c.events.length = 0;
    expect(await reader.latestProvenAt()).toBe('unknown');
    c.events.push(event(990n, 6n));
    expect(await reader.latestProvenAt()).toMatchObject({ checkpoint: 6n });
  });
});

const nodeUrl = process.env.AZTEC_NODE_URL ?? '';
const l1RpcUrl = process.env.L1_RPC_URL ?? '';

describe.skipIf(!nodeUrl || !l1RpcUrl)('the latest proof on the isolated network', () => {
  test(
    "the local network's synthetic prove advances the tip without an event: the reader's true negative, off a real anvil",
    async () => {
      const node = createAztecNodeClient(nodeUrl);
      const info = await node.getNodeInfo();
      const rollup = info.l1ContractAddresses.rollupAddress.toString() as Hex;
      const client = createPublicClient({ transport: http(l1RpcUrl) });
      // Five slots warped, then the prove the e2e control server uses for a settlement: a storage
      // cheat (`settleEpochOutbox`), never `submitEpochRootProof`, so no `L2ProofVerified` exists here.
      const debug = createAztecNodeDebugClient(nodeUrl);
      await debug.warpL2TimeAtLeastBy(72 * 5);
      const proven = await debug.prove();
      expect(proven).toBeGreaterThan(0);
      const reader = proofReader(client, { rollup, floor: async () => 0n, budget: 8 });
      let read = await reader.latestProvenAt();
      while (read === 'unknown') read = await reader.latestProvenAt();
      expect(read).toBe('none');
      expect(
        await client.readContract({
          address: rollup,
          abi: RollupAbi,
          functionName: 'getProvenCheckpointNumber',
        }),
      ).toBeGreaterThan(0n);
    },
    2 * 60_000,
  );
});

const sepoliaRpc = process.env.YACANA_SEPOLIA_RPC_URL ?? '';

describe.skipIf(!sepoliaRpc)("the Aztec testnet's latest proof on Sepolia", () => {
  test(
    'the reader finds a real event through a public RPC and its time is the block’s',
    async () => {
      const rollup = '0xd73a91bdcf6891c7642f3e460036e1ef2cc23178' as Hex;
      const client = createPublicClient({ transport: http(sepoliaRpc) });
      const head = await client.getBlockNumber();
      const reader = proofReader(client, { rollup, floor: async () => head - 200_000n, budget: 6 });
      let read = await reader.latestProvenAt();
      for (let i = 0; i < 10 && read === 'unknown'; i++) read = await reader.latestProvenAt();
      if (typeof read !== 'object') throw new Error(`no proof in the last 200k blocks: ${String(read)}`);
      expect(read.at).toBe((await client.getBlock({ blockNumber: read.block })).timestamp);
      expect(read.checkpoint).toBeGreaterThan(0n);
    },
    2 * 60_000,
  );
});
