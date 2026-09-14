// The name of the custom error a portal call reverted with. The portal's own errors decode from
// its ABI; a revert that bubbles up from a version's Outbox (a nullified leaf, an epoch with no
// root, a witness off its root) carries that contract's error, so both ABIs are consulted.
import { OutboxAbi } from '@aztec/l1-artifacts/OutboxAbi';
import { type BaseError, ContractFunctionRevertedError, decodeErrorResult, type Hex } from 'viem';
import { yacanaPortalAbi } from './portal.ts';

const abis = [...yacanaPortalAbi, ...OutboxAbi];

/** The custom error revert data encodes (a `LeafFailed` reason, a simulation's), by name; the selector when unknown. */
export const errorName = (data: Hex): string => {
  if (data.length < 10) return data === '0x' ? 'empty' : data;
  try {
    return decodeErrorResult({ abi: abis, data }).errorName;
  } catch {
    return data.slice(0, 10);
  }
};

/** What a viem call settled as: `ok`, the revert's error name, or `error` for anything but a revert. */
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
    return errorName(raw);
  }
}
