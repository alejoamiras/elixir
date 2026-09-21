// The portal learns about a Registry transition only when someone tells it: `noteTransition(index)`
// stamps the time index `index` was first seen, and that stamp is the flip time every deadline and
// cap of the version before it counts from. Anyone may call it; the operator does it promptly.
import type { Hex } from 'viem';
import { confirmed, type Operator, writeOpts } from './operator.ts';

/** Every Registry index the portal has not stamped yet, oldest first. */
export async function unobservedTransitions(op: Operator): Promise<bigint[]> {
  const count = await op.registry.read.numberOfVersions();
  const missing: bigint[] = [];
  for (let i = 1n; i < count; i++) {
    if ((await op.portal.read.transitions([i])) === 0n) missing.push(i);
  }
  return missing;
}

export async function noteTransition(op: Operator, index: bigint): Promise<Hex> {
  return confirmed(op, () => op.portal.write.noteTransition([index], writeOpts(op)));
}

/** Stamps every transition the portal has missed; returns the indices it stamped. */
export async function noteAllTransitions(op: Operator): Promise<bigint[]> {
  const missing = await unobservedTransitions(op);
  for (const index of missing) await noteTransition(op, index);
  return missing;
}
