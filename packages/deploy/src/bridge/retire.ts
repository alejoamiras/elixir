// Retiring a version, in the order the portal enforces: the transition after it observed, the
// retire message sent into its Inbox (once, from the portal, so its existence is the authority),
// and the message consumed on the old chain — from then on no claim mints there, while exits and
// arrivals go on. The L1 step is idempotent: sent already, it yields the same index from the log.

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
  /** The message was already on its way: nothing was sent this time. */
  resumed: boolean;
}

/** Blocks per `eth_getLogs`: under the range most public RPCs allow. */
export const LOG_WINDOW = 10_000n;

/**
 * The `Retired` event of an earlier send, for a rerun whose L2 step is still owed: searched from the
 * portal's deploy block (the record's, or genesis) to the head, one window at a time.
 */
async function sentBefore(op: Operator, version: bigint): Promise<RetireSent> {
  const head = await op.publicClient.getBlockNumber();
  for (let from = BigInt(op.record.bridge.deployBlock ?? 0); from <= head; from += LOG_WINDOW) {
    const [log] = await op.publicClient.getContractEvents({
      address: op.portal.address,
      abi: yacanaPortalAbi,
      eventName: 'Retired',
      args: { version },
      fromBlock: from,
      toBlock: from + LOG_WINDOW - 1n < head ? from + LOG_WINDOW - 1n : head,
    });
    if (log?.args.inboxIndex !== undefined)
      return { version, txHash: log.transactionHash, inboxIndex: log.args.inboxIndex, resumed: true };
  }
  throw new Error(`the portal holds version ${version} as retired but the RPC serves no Retired log for it`);
}

export async function retireOnL1(op: Operator, version: bigint): Promise<RetireSent> {
  await noteAllTransitions(op);
  if ((await op.portal.read.flipAt([version])) === 0n)
    throw new Error(`version ${version} has not been flipped away from: nothing to retire`);
  if ((await op.portal.read.versionInfo([version])).retireSent) return sentBefore(op, version);
  const txHash = await confirmed(op, () => op.portal.write.retire([version], writeOpts(op)));
  const receipt = await op.publicClient.getTransactionReceipt({ hash: txHash });
  const [retired] = parseEventLogs({ abi: yacanaPortalAbi, eventName: 'Retired', logs: receipt.logs });
  if (!retired) throw new Error(`retire ${txHash} emitted no Retired event`);
  return { version, txHash, inboxIndex: retired.args.inboxIndex, resumed: false };
}

/** Consumes the retire message on the old chain once the node has synced it (minutes on a real L1). */
export async function retireOnL2(
  l2: L2Side,
  portal: Hex,
  sent: Pick<RetireSent, 'version' | 'inboxIndex'>,
  timeoutSeconds = 1800,
) {
  const served = BigInt((await l2.node.getNodeInfo()).rollupVersion);
  if (served !== sent.version)
    throw new Error(`the node serves version ${served}; the retire was for ${sent.version}`);
  const leaf = await retireLeaf(
    {
      chainId: l2.chainId,
      rollupVersion: l2.rollupVersion,
      miner: AztecAddress.fromStringUnsafe(l2.miner.address.toString()),
      portal: EthAddress.fromString(portal),
    },
    sent.inboxIndex,
  );
  await waitForL1ToL2MessageReady(l2.node, leaf, { timeoutSeconds });
  const result = await l2.miner.methods
    .retire(sent.inboxIndex)
    .send({ from: l2.from, fee: l2.fee, wait: { timeout: 600 } });
  return result.receipt.txHash.toString();
}
