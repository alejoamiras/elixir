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

/** The custom error a thrown viem error reverted with, by name; undefined when it is not a revert. */
export function revertNameOf(e: unknown): string | undefined {
  const reverted = (e as BaseError)?.walk?.((x) => x instanceof ContractFunctionRevertedError);
  if (!(reverted instanceof ContractFunctionRevertedError)) return undefined;
  if (reverted.data?.errorName) return reverted.data.errorName;
  const raw = reverted.raw as Hex | undefined;
  return raw ? errorName(raw) : 'reverted';
}

/** What a viem call settled as: `ok`, the revert's error name, or `error` for anything but a revert. */
export async function revertName(p: Promise<unknown>): Promise<string> {
  try {
    await p;
    return 'ok';
  } catch (e) {
    return revertNameOf(e) ?? 'error';
  }
}

/**
 * The portal's reverts a holder can meet, in the words of the row they would land on; `version`
 * names the crossing's own version ("V5"). Operator-only and encoding errors have no line: those
 * reach a holder only through a bug, and the raw name says more.
 */
const REVERT_LINES: Record<string, (version: string) => string> = {
  WaitsForHeadroom: (v) =>
    `More has left ${v} than its exit limit allows right now. It turns ready once it fits; others may use the room first.`,
  VersionPaused: () => 'The bridge is paused: claims on Ethereum wait until it lifts.',
  DeadlinePassed: (v) => `${v}’s last day passed before this was claimed. It cannot leave any more.`,
  DeadlineExpired: () => 'The deposit’s own deadline passed before Ethereum included it. Deposit again.',
  DepositsAreClosed: (v) => `Deposits into ${v} are closed for good.`,
  NotRegistered: (v) => `Bridging opens once Yacana registers ${v} on Ethereum.`,
  NotCanonical: (v) => `${v} is not the live version any more: deposit on the live version’s page.`,
  NotForwardable: () => 'The live version is not registered on the portal yet: the forward waits for Yacana.',
  FlipUnrecorded: () =>
    'The upgrade is not recorded on the portal yet: note the transition first, then forward.',
  SignatureExpired: () => 'The signature expired before the wallet sent it. Try again.',
  NotAuthorised: () => 'Only this account’s own key or a listed forwarder may forward it.',
  Outbox__AlreadyNullified: () => 'Already claimed on Ethereum: the portal consumed this leaf before.',
  Outbox__NothingToConsumeAtEpoch: () => 'Its epoch’s proof is not on Ethereum yet: the claim waits for it.',
  Outbox__InvalidRecipient: () => 'The portal is not the leaf’s recipient: this is not a Yacana exit.',
};

/** The row's sentence for a revert name, or undefined for one the table does not know. */
export const revertLine = (name: string, version: string): string | undefined =>
  REVERT_LINES[name]?.(version);

/** A thrown error explained in the row's words when it is a known revert; undefined otherwise. */
export const explainRevert = (e: unknown, version: string): string | undefined => {
  const name = revertNameOf(e);
  return name ? revertLine(name, version) : undefined;
};
