// The operators' brake: a bounded pause per version (the portal enforces the maximum and the
// budget), one call for every registered version, and the release.
import type { Hex } from 'viem';
import { confirmed, type Operator, writeOpts } from './operator.ts';

export const pause = (op: Operator, version: bigint, seconds: bigint): Promise<Hex> =>
  confirmed(op, () => op.portal.write.pause([version, seconds], writeOpts(op)));

export const pauseAll = (op: Operator, seconds: bigint): Promise<Hex> =>
  confirmed(op, () => op.portal.write.pauseAll([seconds], writeOpts(op)));

export const unpause = (op: Operator, version: bigint): Promise<Hex> =>
  confirmed(op, () => op.portal.write.unpause([version], writeOpts(op)));

/** No more deposits into `version`: the step before a retirement, so nothing lands after it. */
export const closeDeposits = (op: Operator, version: bigint): Promise<Hex> =>
  confirmed(op, () => op.portal.write.closeDeposits([version], writeOpts(op)));
