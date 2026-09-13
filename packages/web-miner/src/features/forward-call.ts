// The forward of an exit as a call anyone may send from anywhere: the portal's address and the
// calldata, built from the witness the journal holds. A send-ahead is not offered this way: its
// forward needs the holder's signature or a listed forwarder.
import { type ContractFunctionArgs, encodeFunctionData, type Hex } from 'viem';
import type { Crossing } from '../../../bridge/src/journal.ts';
import { yacanaPortalAbi } from '../../../bridge/src/portal.ts';
import { forwardArgsFromArchive } from '../../../bridge/src/witness.ts';

type PortalForwardArgs = ContractFunctionArgs<typeof yacanaPortalAbi, 'nonpayable', 'forward'>[1];

export interface ForwardCall {
  to: Hex;
  data: Hex;
}

/** The exit's forward as `to` and `data`, or nothing before its witness is saved. */
export function forwardCall(c: Crossing): ForwardCall | undefined {
  if (c.kind !== 1 || !c.witness) return undefined;
  const args = forwardArgsFromArchive(c.witness);
  const data = encodeFunctionData({
    abi: yacanaPortalAbi,
    functionName: 'forward',
    args: [BigInt(c.version), { ...args, kind: args.kind as number } as PortalForwardArgs],
  });
  return { to: c.portal, data };
}
