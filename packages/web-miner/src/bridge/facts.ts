// What a crossing's next reading needs, and nothing more: a record that is still proving asks the
// node about its transaction; one waiting for its epoch asks the rollup about the proof; a
// witnessed one asks the portal; a forwarded or deposited one asks the destination node whether the
// message is there. Each source is behind one function so a test can stand in for it.
import type { Crossing, Facts } from '../../../bridge/src/journal.ts';
import type { ArchivedExit } from '../../../bridge/src/witness.ts';

export interface FactReads {
  /** Undefined when nothing here can answer: a version this build's node does not serve. */
  tx(c: Crossing): Promise<Facts['tx']>;
  /** The epoch a block belongs to: a record the send left with a block and no epoch asks once. */
  epochOfBlock(c: Crossing, block: number): Promise<string | undefined>;
  /** Both on the crossing's own version's rollup, whichever build reads them. */
  proofDeadline(c: Crossing, epoch: bigint): Promise<bigint>;
  epochProven(c: Crossing, epoch: bigint): Promise<boolean>;
  /** The witness once the epoch is proven; undefined before. */
  witness(c: Crossing): Promise<ArchivedExit | undefined>;
  portal(c: Crossing): Promise<NonNullable<Facts['portal']>>;
  forwarded(c: Crossing): Promise<Facts['forwarded']>;
  redeemed(c: Crossing): Promise<Facts['redeemed']>;
  messageReady(c: Crossing): Promise<boolean>;
  claimed(c: Crossing): Promise<Facts['claimed']>;
  /** Ethereum's clock, which every deadline is measured against; the device's may differ. */
  nowSeconds(): Promise<bigint>;
}

const AWAITING_PROOF = new Set<Crossing['state']>(['proven-pending']);
const ON_PORTAL = new Set<Crossing['state']>([
  'witnessed',
  'paused',
  'headroom',
  'ready',
  'held',
  'not-registered',
]);
const AT_DESTINATION = new Set<Crossing['state']>(['forwarded', 'deposited']);

/** A send without a hash is still asked about: the node may know it by its tag. A deposit's tale is Ethereum's. */
const txFacts = async (reads: FactReads, c: Crossing, f: Facts): Promise<Facts> =>
  c.txHash || c.kind !== 3 ? { ...f, tx: await reads.tx(c) } : f;

/** The epoch's proof: its deadline, whether it landed, the witness once it has; pruned when the deadline passed without it. */
async function epochFacts(reads: FactReads, c: Crossing, f: Facts): Promise<Facts> {
  const known = c.epoch ?? (c.block === undefined ? undefined : await reads.epochOfBlock(c, c.block));
  if (!known) return f;
  const epoch = BigInt(known);
  const deadline = c.proofDeadline ? BigInt(c.proofDeadline) : await reads.proofDeadline(c, epoch);
  const epochProven = await reads.epochProven(c, epoch);
  const next: Facts = { ...f, epoch: known, proofDeadline: deadline.toString(), epochProven };
  if (epochProven) next.witness = await reads.witness(c);
  else next.epochPruned = (await reads.nowSeconds()) > deadline;
  return next;
}

/** An event answers for the leaf before the portal's standing is asked. */
async function portalFacts(reads: FactReads, c: Crossing, f: Facts): Promise<Facts> {
  const forwarded = await reads.forwarded(c);
  if (forwarded) return { ...f, forwarded };
  const redeemed = c.kind === 2 ? await reads.redeemed(c) : undefined;
  if (redeemed) return { ...f, redeemed };
  return { ...f, portal: await reads.portal(c) };
}

async function destinationFacts(reads: FactReads, c: Crossing, f: Facts): Promise<Facts> {
  const messageReady = AT_DESTINATION.has(c.state) ? await reads.messageReady(c) : undefined;
  const next: Facts = messageReady === undefined ? f : { ...f, messageReady };
  if (c.state === 'claimable' || messageReady) next.claimed = await reads.claimed(c);
  return next;
}

/** The facts for one reading of `c`, from the sources its state depends on. */
export async function factsFor(reads: FactReads, c: Crossing, now: number): Promise<Facts> {
  const f: Facts = { now };
  if (c.state === 'proving' || c.state === 'sent') return txFacts(reads, c, f);
  if (AWAITING_PROOF.has(c.state)) return epochFacts(reads, c, f);
  if (ON_PORTAL.has(c.state)) return portalFacts(reads, c, f);
  return destinationFacts(reads, c, f);
}
