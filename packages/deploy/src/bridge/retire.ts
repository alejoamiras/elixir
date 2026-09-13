// Retiring a version, in the order the portal enforces: the transition after it observed, the
// retire message sent into its Inbox (once, from the portal, so its existence is the authority),
// and the message consumed on the old chain — from then on no claim mints there, while exits and
// arrivals go on.

import { waitForL1ToL2MessageReady } from '@aztec/aztec.js/messaging';
import { EthAddress } from '@aztec/foundation/eth-address';
import { AztecAddress } from '@aztec/stdlib/aztec-address';
import { retireLeaf } from '@yacana/bridge/src/inbox.ts';
import { yacanaPortalAbi } from '@yacana/bridge/src/portal.ts';
import { type Hex, parseEventLogs } from 'viem';
import type { L2Side } from './l2.ts';
import { confirmed, type Operator, writeOpts } from './operator.ts';
import { noteAllTransitions } from './transition.ts';

export interface RetireSent {
  version: bigint;
  txHash: Hex;
  /** The message's index in the version's Inbox: what the L2 `retire` names. */
  inboxIndex: bigint;
}

export async function retireOnL1(op: Operator, version: bigint): Promise<RetireSent> {
  await noteAllTransitions(op);
  if ((await op.portal.read.flipAt([version])) === 0n)
    throw new Error(`version ${version} has not been flipped away from: nothing to retire`);
  const txHash = await confirmed(op, () => op.portal.write.retire([version], writeOpts(op)));
  const receipt = await op.publicClient.getTransactionReceipt({ hash: txHash });
  const [retired] = parseEventLogs({ abi: yacanaPortalAbi, eventName: 'Retired', logs: receipt.logs });
  if (!retired) throw new Error(`retire ${txHash} emitted no Retired event`);
  return { version, txHash, inboxIndex: retired.args.inboxIndex };
}

/** Consumes the retire message on the old chain once the node has synced it (minutes on a real L1). */
export async function retireOnL2(l2: L2Side, portal: Hex, inboxIndex: bigint, timeoutSeconds = 1800) {
  const leaf = await retireLeaf(
    {
      chainId: l2.chainId,
      rollupVersion: l2.rollupVersion,
      miner: AztecAddress.fromStringUnsafe(l2.miner.address.toString()),
      portal: EthAddress.fromString(portal),
    },
    inboxIndex,
  );
  await waitForL1ToL2MessageReady(l2.node, leaf, { timeoutSeconds });
  const result = await l2.miner.methods
    .retire(inboxIndex)
    .send({ from: l2.from, fee: l2.fee, wait: { timeout: 600 } });
  return result.receipt.txHash.toString();
}
