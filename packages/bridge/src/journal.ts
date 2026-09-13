// A crossing's record and the one reducer that moves it: every state a card can be in is a state
// here, and each is entered from facts read off a source of truth — the source node (a block, the
// proven epoch, a witness), the portal through the Ethereum RPC (paused, headroom, the deadline,
// a Forwarded or Deposited event), the target node (the Inbox message available) and the wallet
// (a claim in a block). `advance` is pure: the same record and facts give the same record, so a
// journal restored from a file refreshes the same way a live one does.
import type { Hex } from 'viem';
import type { ArchivedExit } from './witness.ts';

/** 1: an exit to Ethereum. 2: a send-ahead to the next version. 3: a deposit from Ethereum. */
export type CrossingKind = 1 | 2 | 3;

export type CrossingState =
  /** The wallet is proving the transaction (K1, K2) or the Ethereum wallet is being asked (K3). */
  | 'proving'
  /** Sent to the node; not in a block yet. */
  | 'sent'
  /** The node never included it: send again. */
  | 'dropped'
  /** In a block; its epoch's proof is not on Ethereum yet (the deadline is shown). */
  | 'proven-pending'
  /** The epoch reached Ethereum and the Outbox witness is saved (K1, K2). */
  | 'witnessed'
  /** The epoch's proof deadline passed and the chain pruned it: the burn is undone. */
  | 'never-proven'
  /** The portal holds every forward of this version for now. */
  | 'paused'
  /** More has left the version than its schedule allows for now; it keeps its place. */
  | 'headroom'
  /** The version's exits closed: nothing more leaves. */
  | 'closed'
  /** K1: consumable on the portal by anyone. */
  | 'ready'
  /** K1 forwarded or K2 redeemed: YACA minted on Ethereum. */
  | 'minted-l1'
  /** K2: held on Ethereum until the next version is live and registered; redeemable meanwhile. */
  | 'held'
  /** K2: the next version is canonical but Yacana has not registered its miner yet. */
  | 'not-registered'
  /** K2: in the next version's Inbox; claim there. */
  | 'forwarded'
  /** K3: deposited on Ethereum; crossing to Aztec. */
  | 'deposited'
  /** The Inbox message is available on the destination node: claim it. */
  | 'claimable'
  /** Claimed on Aztec, privately. */
  | 'minted-l2';

export const FINAL_STATES: ReadonlySet<CrossingState> = new Set([
  'dropped',
  'never-proven',
  'closed',
  'minted-l1',
  'minted-l2',
]);

export interface Crossing {
  /** `<chainId>:<portal>:<version>:<kind>:<index>`, the same on every device of the account; another message under an index the journal already holds gets that id plus a suffix naming the message. */
  id: string;
  kind: CrossingKind;
  chainId: string;
  portal: Hex;
  /** The source version (K1, K2) or the destination (K3). */
  version: string;
  /** The crossing's secret index under the account's master. */
  index: number;
  amount: string;
  state: CrossingState;
  createdAt: number;
  updatedAt: number;
  /** K1: the Ethereum recipient. K2: the redeem address. K3: the depositor. */
  ethAddress: Hex;
  txHash?: string;
  block?: number;
  epoch?: string;
  /** Unix seconds by which the epoch's proof must be on Ethereum, or the epoch is pruned. */
  proofDeadline?: string;
  witness?: ArchivedExit;
  /** K2: the version it was forwarded into. */
  target?: string;
  /** K2, K3: the Inbox message the claim consumes. */
  inboxIndex?: string;
  /** The Ethereum transaction that forwarded, redeemed or deposited it. */
  l1TxHash?: Hex;
  claimTxHash?: string;
  /** The block the claim landed in; until its checkpoint is proven the block can still be pruned. */
  claimBlock?: number;
  /** The claim's checkpoint is covered by a proof on Ethereum: the mint cannot be undone. */
  claimSettled?: boolean;
  /** The last failure of an action on it, for the card; cleared by the next success. */
  error?: string;
}

/** What was read, each field from its own source; absent means "not read", never "false". */
export interface Facts {
  now: number;
  /** `txHash` names the transaction for a record that lost its hash (the page closed after the send). */
  tx?: { status: 'pending' | 'mined' | 'dropped'; block?: number; epoch?: string; txHash?: string };
  /** The epoch of the record's block, read for a record that only knew the block. */
  epoch?: string;
  proofDeadline?: string;
  /** The source version's proven epoch has reached this crossing's epoch. */
  epochProven?: boolean;
  /** The epoch's deadline passed without a proof and the chain pruned it. */
  epochPruned?: boolean;
  witness?: ArchivedExit;
  portal?: {
    paused?: boolean;
    /** Whether the version has room for this amount now. */
    hasHeadroom?: boolean;
    deadlinePassed?: boolean;
    /** The Outbox nullified this leaf: forwarded or redeemed. */
    consumed?: boolean;
    /** K2: the canonical version is registered with the announced miner. */
    canonicalRegistered?: boolean;
    canonicalIsNewer?: boolean;
  };
  forwarded?: { txHash: Hex; inboxIndex: string; target: string };
  redeemed?: { txHash: Hex };
  deposited?: { txHash: Hex; inboxIndex: string };
  messageReady?: boolean;
  claimed?: { txHash: string; block: number };
  error?: string | null;
}

/** The same record when nothing would change: `updatedAt` moves only with the record. */
const at = (c: Crossing, state: CrossingState, now: number, patch: Partial<Crossing> = {}): Crossing => {
  const same =
    c.state === state &&
    Object.entries(patch).every(([k, v]) => (c as unknown as Record<string, unknown>)[k] === v);
  return same ? c : { ...c, ...patch, state, updatedAt: now };
};

/** The L2 transaction's fate, common to exits and send-aheads. */
function afterTx(c: Crossing, f: Facts): Crossing {
  if (!f.tx) return c;
  const named = f.tx.txHash && !c.txHash ? { txHash: f.tx.txHash } : {};
  if (f.tx.status === 'dropped') return at(c, 'dropped', f.now, named);
  if (f.tx.status === 'mined' && (c.state === 'proving' || c.state === 'sent'))
    return at(c, 'proven-pending', f.now, { ...named, block: f.tx.block, epoch: f.tx.epoch });
  if (f.tx.status === 'pending' && c.state === 'proving') return at(c, 'sent', f.now, named);
  return c;
}

/** The epoch's settlement: pruned undoes the burn, proven with a witness makes the leaf real. */
function afterEpoch(c: Crossing, f: Facts): Crossing {
  let next = f.epoch && !c.epoch ? { ...c, epoch: f.epoch } : c;
  if (f.proofDeadline && next.proofDeadline !== f.proofDeadline)
    next = { ...next, proofDeadline: f.proofDeadline };
  if (f.epochPruned && (next.state === 'proven-pending' || next.state === 'sent'))
    return at(next, 'never-proven', f.now);
  if (f.witness && !next.witness) next = { ...next, witness: f.witness };
  if (next.state === 'proven-pending' && f.epochProven && next.witness) return at(next, 'witnessed', f.now);
  return next;
}

/** What the portal says about a witnessed leaf, before anyone acts on it. */
function onPortal(c: Crossing, f: Facts): Crossing {
  const p = f.portal;
  if (!p || !c.witness || FINAL_STATES.has(c.state)) return c;
  if (p.deadlinePassed) return at(c, 'closed', f.now);
  if (p.paused) return at(c, 'paused', f.now);
  if (p.hasHeadroom === false) return at(c, 'headroom', f.now);
  if (c.kind === 1) return at(c, 'ready', f.now);
  if (p.canonicalIsNewer === false || p.canonicalRegistered === undefined) return at(c, 'held', f.now);
  return at(c, p.canonicalRegistered ? 'held' : 'not-registered', f.now);
}

/** The Ethereum side's outcomes, then the destination's. */
function afterEthereum(c: Crossing, f: Facts): Crossing {
  if (f.redeemed) return at(c, 'minted-l1', f.now, { l1TxHash: f.redeemed.txHash });
  if (f.forwarded) {
    const patch = {
      l1TxHash: f.forwarded.txHash,
      inboxIndex: f.forwarded.inboxIndex,
      target: f.forwarded.target,
    };
    return c.kind === 1 ? at(c, 'minted-l1', f.now, patch) : at(c, 'forwarded', f.now, patch);
  }
  if (f.deposited && c.kind === 3)
    return at(c, 'deposited', f.now, { l1TxHash: f.deposited.txHash, inboxIndex: f.deposited.inboxIndex });
  return c;
}

function afterDestination(c: Crossing, f: Facts): Crossing {
  if (f.claimed)
    return at(c, 'minted-l2', f.now, {
      claimBlock: f.claimed.block,
      ...(f.claimed.txHash ? { claimTxHash: f.claimed.txHash } : {}),
    });
  if (f.messageReady && (c.state === 'forwarded' || c.state === 'deposited'))
    return at(c, 'claimable', f.now);
  return c;
}

/**
 * One step of the record under the facts read now. Final states never move again; a consumed leaf
 * without its event yet is left where it is until the event is read.
 */
export function advance(c: Crossing, f: Facts): Crossing {
  if (FINAL_STATES.has(c.state)) return c;
  let next = c;
  if (next.kind !== 3) {
    next = afterTx(next, f);
    next = afterEpoch(next, f);
    next = onPortal(next, f);
  } else if (f.tx?.status === 'dropped' && next.state === 'proving') {
    // A deposit the wallet never sent, or Ethereum never included before its deadline.
    next = at(next, 'dropped', f.now);
  }
  next = afterEthereum(next, f);
  next = afterDestination(next, f);
  if (f.error !== undefined) {
    const error = f.error ?? undefined;
    if (next.error !== error) next = { ...next, error, updatedAt: f.now };
  }
  return next;
}

/** The version a crossing lands on and is claimed from: a deposit's own, a send-ahead's target; an exit lands on Ethereum. */
export const destinationOf = (c: Crossing): string | undefined =>
  c.kind === 3 ? c.version : c.kind === 2 ? c.target : undefined;

export const crossingId = (c: Pick<Crossing, 'chainId' | 'portal' | 'version' | 'kind' | 'index'>): string =>
  `${c.chainId}:${c.portal.toLowerCase()}:${c.version}:${c.kind}:${c.index}`;

/** A crossing that still asks something of the reader: neither settled for good nor a send-again. */
export const inFlight = (c: Crossing): boolean => !FINAL_STATES.has(c.state);

/** A finished crossing stays on the card a week, then fades from the journal. */
export const FADE_AFTER_MS = 7 * 24 * 3600 * 1000;
export const visible = (c: Crossing, now: number): boolean =>
  inFlight(c) || now - c.updatedAt < FADE_AFTER_MS;
