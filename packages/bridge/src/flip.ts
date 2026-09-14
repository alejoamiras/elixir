// Whether this build's version has been flipped away from, from several signals, none of which
// alone is authoritative and none of which is always readable: the Registry's canonical version
// (the truth, when the Ethereum RPC answers), the miner's own `retired` flag (set once the retire
// message is consumed, minutes after), and the node's version (a node for another version says
// nothing about the flip, only about the node). Silence renders `unknown`, never "not flipped".
export interface FlipSignals {
  buildVersion: bigint;
  /** The Registry's canonical version, or null when the RPC did not answer. */
  registryCanonical: bigint | null;
  /** The miner's `retired` flag, or null when the node did not answer. */
  minerRetired: boolean | null;
  /** The version the node serves, or null. */
  nodeVersion: bigint | null;
}

export type FlipVerdict =
  | { kind: 'unknown' }
  | { kind: 'before' }
  | { kind: 'flipped'; by: ('registry' | 'retired')[] }
  /** The node serves another version: a setting problem, not a flip. */
  | { kind: 'wrong-node'; nodeVersion: bigint };

export function flipVerdict(s: FlipSignals): FlipVerdict {
  if (s.nodeVersion !== null && s.nodeVersion !== s.buildVersion)
    return { kind: 'wrong-node', nodeVersion: s.nodeVersion };
  const by: ('registry' | 'retired')[] = [];
  if (s.registryCanonical !== null && s.registryCanonical !== s.buildVersion) by.push('registry');
  if (s.minerRetired === true) by.push('retired');
  if (by.length > 0) return { kind: 'flipped', by };
  if (s.registryCanonical === s.buildVersion || s.minerRetired === false) return { kind: 'before' };
  return { kind: 'unknown' };
}
