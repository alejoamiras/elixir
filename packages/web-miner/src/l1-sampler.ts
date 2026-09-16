// The rollup's pending checkpoint from L1, every fifteen seconds, signed in or out: the one reading
// that says whether the node has every block it should. Its own viem client on the RPC in use; the
// bridge's session, which needs an account, is not involved. Failures are logged and waited out.
import { RollupAbi } from '@aztec/l1-artifacts/RollupAbi';
import type { Hex } from 'viem';
import { ethRpcClient } from '../../site/src/browser/eth-rpc.ts';
import { recordL1 } from '../../site/src/browser/node-health.ts';

export const L1_SAMPLE_MS = 15_000;

export interface L1Sampler {
  stop(): void;
  /** One reading now (the one in flight, if any); resolves when it settled. */
  tick(): Promise<void>;
}

export function startL1Sampler(o: {
  /** Read at every tick: the RPC the user switches to is sampled from the next one. */
  rpcUrl: () => string;
  rollup: string;
  chainId: bigint;
  intervalMs?: number;
  make?: typeof ethRpcClient;
  log?: (line: string) => void;
}): L1Sampler {
  const make = o.make ?? ethRpcClient;
  let url = '';
  let client: ReturnType<typeof ethRpcClient> | undefined;
  let inflight: Promise<void> | undefined;
  const read = async () => {
    const next = o.rpcUrl();
    if (!next) return;
    if (!client || next !== url) {
      url = next;
      client = make(next);
    }
    const c = client;
    const [chainId, head, pending] = await Promise.all([
      c.getChainId(),
      c.getBlockNumber({ cacheTime: 0 }),
      c.readContract({
        address: o.rollup as Hex,
        abi: RollupAbi,
        functionName: 'getPendingCheckpointNumber',
      }),
    ]);
    // Another chain's rollup says nothing about this node.
    if (BigInt(chainId) !== o.chainId) return;
    recordL1({ pendingCheckpoint: Number(pending), head: Number(head) });
  };
  const tick = (): Promise<void> => {
    if (!inflight)
      inflight = read()
        .catch((e: unknown) => o.log?.(`L1 sample: ${e instanceof Error ? e.message : String(e)}`))
        .finally(() => {
          inflight = undefined;
        });
    return inflight;
  };
  void tick();
  const timer = setInterval(() => void tick(), o.intervalMs ?? L1_SAMPLE_MS);
  return {
    stop: () => clearInterval(timer),
    tick,
  };
}
