// Chain reads the miner needs: the open epoch, its parameters and its claim count. A lying RPC
// can only waste work here, never steal — claims are verified on-chain.
import type { AztecAddress } from '@aztec/aztec.js/addresses';
import type { Contract } from '@aztec/aztec.js/contracts';

export interface EpochParams {
  target: bigint;
  seed: bigint;
  openedAt: bigint;
}

export interface EpochView {
  epoch: bigint;
  params: EpochParams;
  claims: number;
}

// simulate() wraps the decoded return value: { result, offchainEffects, offchainMessages }.
const unwrap = async <T>(p: Promise<unknown>): Promise<T> => ((await p) as { result: T }).result;

export async function readOpenEpoch(miner: Contract, from: AztecAddress): Promise<EpochView> {
  const epoch = await unwrap<bigint>(miner.methods.open_epoch().simulate({ from }));
  const raw = await unwrap<{ target: bigint; seed: bigint; opened_at: bigint }>(
    miner.methods.epoch_params(epoch).simulate({ from }),
  );
  const claims = Number(await unwrap<bigint>(miner.methods.claims_in(epoch).simulate({ from })));
  return { epoch, params: { target: raw.target, seed: raw.seed, openedAt: raw.opened_at }, claims };
}

export const readRules = async (miner: Contract, from: AztecAddress) => {
  const [n, expected, tMax, reward] = await unwrap<bigint[]>(miner.methods.constants().simulate({ from }));
  return { N: Number(n), EXPECTED_EPOCH_SECONDS: expected ?? 0n, T_MAX: tMax ?? 0n, REWARD: reward ?? 0n };
};
