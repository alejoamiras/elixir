// The name of the custom error a simulated portal call reverts with. The portal's own errors decode
// from its ABI; a revert that bubbles up from the version's Outbox (a nullified leaf, an epoch with
// no root) carries that contract's error, so both ABIs are consulted.
import { OutboxAbi } from '@aztec/l1-artifacts/OutboxAbi';
import { yacanaPortalAbi } from '@yacana/bridge/src/portal.ts';
import { type BaseError, ContractFunctionRevertedError, decodeErrorResult, type Hex } from 'viem';

const abis = [...yacanaPortalAbi, ...OutboxAbi];

/** The custom error a `LeafFailed` reason (or any revert data) encodes, by name; the selector when unknown. */
export const errorName = (data: Hex): string => {
  if (data.length < 10) return data === '0x' ? 'empty' : data;
  try {
    return decodeErrorResult({ abi: abis, data }).errorName;
  } catch {
    return data.slice(0, 10);
  }
};

export async function revertName(p: Promise<unknown>): Promise<string> {
  try {
    await p;
    return 'ok';
  } catch (e) {
    const reverted = (e as BaseError).walk?.((x) => x instanceof ContractFunctionRevertedError);
    if (!(reverted instanceof ContractFunctionRevertedError)) return 'error';
    if (reverted.data?.errorName) return reverted.data.errorName;
    const raw = reverted.raw as Hex | undefined;
    if (!raw) return 'reverted';
    try {
      return decodeErrorResult({ abi: abis, data: raw }).errorName;
    } catch {
      return `reverted ${raw.slice(0, 10)}`;
    }
  }
}
