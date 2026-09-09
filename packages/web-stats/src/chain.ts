// The reader the beats read through: the deployment check, the layouts, the node; and the latest block.
import { AztecAddress } from '@aztec/aztec.js/addresses';
import {
  assertDeployment,
  DEFAULT_LIMITS,
  expectedFromStrings,
  type Node,
  type SlotLoader,
  type StorageLayout,
} from '../../miner-core/src/reader.ts';
import { type Connection, expectedDeployment } from '../../site/src/browser/connection.ts';
import { nodeClient } from '../../site/src/browser/node.ts';
import { setNodeEndpoint } from '../../site/src/browser/node-guard.ts';
import { chunkLoader, fetchLayouts } from '../../site/src/browser/slots.ts';

/** The poll's cadence; the banner calls the numbers stale after two of them. */
export const POLL_MS = 30_000;

export interface Reader {
  node: Node;
  miner: AztecAddress;
  token: AztecAddress;
  minerLayout: StorageLayout;
  tokenLayout: StorageLayout;
  load: SlotLoader;
}

/** The boot check, then the layouts the reads need. */
export async function openReader(connection: Connection): Promise<Reader> {
  // A read the reader gave up on ends with it: one deadline per request, no transport retries
  // (the SDK's default would keep an abandoned read alive through three more attempts).
  setNodeEndpoint(connection.nodeUrl, DEFAULT_LIMITS.timeoutMs);
  const node = nodeClient(connection.nodeUrl);
  const layout = await fetchLayouts();
  const expected = expectedDeployment();
  await assertDeployment(
    node,
    expectedFromStrings({
      chainId: expected.chainId.toString(),
      rollupVersion: expected.rollupVersion.toString(),
      rollupAddress: expected.rollupAddress,
      miner: connection.miner,
      minerClassId: expected.minerClassId,
      token: connection.token,
      tokenClassId: expected.tokenClassId,
    }),
    layout.miner,
  );
  return {
    node,
    miner: AztecAddress.fromStringUnsafe(connection.miner),
    token: AztecAddress.fromStringUnsafe(connection.token),
    minerLayout: layout.miner,
    tokenLayout: layout.token,
    load: chunkLoader(),
  };
}
