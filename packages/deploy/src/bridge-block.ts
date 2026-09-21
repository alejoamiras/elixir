// The record's `bridge` block when a miner is deployed after the portal: carried from the
// continuation's source record, or from the block the L1 deploy left beside the record
// (`deployments/<profile>.bridge.json`) when no record existed yet. The miner's portal is
// immutable, so whichever block is carried must name the portal this miner was deployed to trust.
import type { BridgeRecord } from '@yacana/bridge/record';

export function carriedBridge(
  portal: string,
  candidates: { from: string; bridge: BridgeRecord | undefined }[],
): BridgeRecord | undefined {
  for (const c of candidates) {
    if (!c.bridge) continue;
    if (c.bridge.portal.toLowerCase() !== portal.toLowerCase())
      throw new Error(`${c.from} names portal ${c.bridge.portal}; this miner trusts ${portal}`);
    return c.bridge;
  }
  return undefined;
}
