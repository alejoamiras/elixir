// What a crossing's card says, per state: the sentence, the action it offers and how it reads. A
// withdrawal ends with its holder's claim on Ethereum (anyone may make it); a send-ahead is forwarded
// by Yacana, its holder or an authorized relayer, or redeemed. The only time promised is the proof's.
import type { Crossing, CrossingState } from '../../../bridge/src/journal.ts';
import type { TrailItem } from '../../../ui/src/bridge-types.ts';
import { duration } from '../lib/format';

export type Tone = 'quiet' | 'busy' | 'good' | 'warn' | 'bad';

export interface CardLine {
  /** The short word the card leads with. */
  word: string;
  sentence: string;
  tone: Tone;
  /** What the card offers, if anything. */
  action?: 'claim' | 'forward' | 'redeem' | 'send-again' | 'change-rpc';
}

const kindNoun = (c: Crossing) =>
  c.kind === 1 ? 'the exit' : c.kind === 2 ? 'the send-ahead' : 'the deposit';

/** Seconds until `deadline` (unix s), as "in 12 min" or "3 h ago". */
export const untilOrAgo = (deadline: bigint, nowSeconds: number): string => {
  const delta = Number(deadline) - nowSeconds;
  return delta >= 0 ? `in ${duration(delta)}` : `${duration(-delta)} ago`;
};

type Line = (c: Crossing, nowSeconds: number, version: string, flipped: boolean, target: string) => CardLine;

const hhmm = (unixSeconds: string): string =>
  new Date(Number(unixSeconds) * 1000).toISOString().slice(11, 16);

/** The proof's ETA: the epoch's deadline when the journal knows it, the usual wait otherwise. */
const provenBy = (c: Crossing): string =>
  c.proofDeadline
    ? `Proven to Ethereum by ${hhmm(c.proofDeadline)} at the latest`
    : 'Proven to Ethereum within the hour';

const LINES: Record<CrossingState, Line> = {
  proving: (c) =>
    c.kind === 3
      ? {
          word: 'wallet',
          sentence: 'Waiting for your Ethereum wallet. If its prompt is gone, deposit again.',
          tone: 'busy',
          action: 'send-again',
        }
      : { word: 'proving', sentence: 'Proving in your browser, about 20 s.', tone: 'busy' },
  sent: () => ({ word: 'sent', sentence: 'Sent. Waiting for a block.', tone: 'busy' }),
  dropped: (c) => ({
    word: 'dropped',
    sentence:
      c.kind === 3
        ? 'Your wallet never sent it, or Ethereum never included it before its deadline. Nothing left your wallet: deposit again.'
        : 'The node never included it. Nothing left this account: send again.',
    tone: 'warn',
    action: 'send-again',
  }),
  'proven-pending': (c, _now, _v, _flipped, target) => ({
    word: 'proving to Ethereum',
    sentence: `${provenBy(c)}; then ${c.kind === 1 ? 'you claim it there' : `it is held there for ${target}`}.`,
    tone: 'busy',
  }),
  witnessed: (c, _now, _v, _flipped, target) => ({
    word: 'proven',
    sentence:
      c.kind === 1
        ? 'Proven to Ethereum. Claim it there any time.'
        : `Proven to Ethereum; held there for ${target}.`,
    tone: 'busy',
  }),
  'never-proven': (_c, _now, v) => ({
    word: 'undone',
    sentence: `${v} never proved it in time: the burn was undone and the balance is back on ${v}.`,
    tone: 'warn',
    action: 'send-again',
  }),
  paused: (c) => ({
    word: 'paused',
    sentence: `The bridge is paused; it moves again when the pause lifts, 30 days at most${c.kind === 2 ? '. Redeem it on Ethereum any time' : ''}.`,
    tone: 'warn',
  }),
  headroom: (_c, _now, _v, flipped) => ({
    word: flipped ? 'over the limit' : 'waiting for the limit',
    sentence: flipped
      ? 'Beyond the version’s frozen exit limit: it cannot leave.'
      : 'More has left this version than its exit limit allows for now; it goes through once the limit grows.',
    tone: 'warn',
  }),
  closed: (_c, _now, v) => ({
    word: 'closed',
    sentence: `${v}'s last day passed before this was claimed. Gone.`,
    tone: 'bad',
  }),
  ready: () => ({
    word: 'ready to claim',
    sentence: 'Proven. Claim it on Ethereum with a wallet: one transaction, you pay the gas.',
    tone: 'good',
    action: 'forward',
  }),
  'minted-l1': (c) => ({
    word: c.kind === 2 ? 'redeemed' : 'claimed',
    sentence: c.kind === 2 ? 'Redeemed: YACA on Ethereum.' : 'Claimed: YACA on Ethereum.',
    tone: 'good',
  }),
  held: (_c, _now, _v, _flipped, target) => ({
    word: 'held on Ethereum',
    sentence: `Held on Ethereum for ${target}, out of the old version’s reach. Yacana forwards it once ${target} opens; you can too, or redeem it on Ethereum, any time.`,
    tone: 'busy',
    action: 'redeem',
  }),
  'not-registered': () => ({
    word: 'waiting for Yacana',
    sentence:
      'The next version is live; Yacana has not opened its contract there yet. Redeem on Ethereum any time.',
    tone: 'warn',
    action: 'redeem',
  }),
  forwarded: (_c, _now, _v, _flipped, target) => ({
    word: 'arrived',
    sentence: `On Aztec ${target}. Claim it there with this passkey.`,
    tone: 'busy',
  }),
  deposited: () => ({
    word: 'crossing',
    sentence: 'Deposited on Ethereum; crossing to Aztec, a few minutes.',
    tone: 'busy',
  }),
  claimable: () => ({
    word: 'ready to claim',
    sentence: 'On Aztec. Claim it here: one tap, about 20 s.',
    tone: 'good',
    action: 'claim',
  }),
  'minted-l2': () => ({
    word: 'claimed',
    sentence: 'Claimed here, privately.',
    tone: 'good',
  }),
};

/** The card's line for `c`: `version` names the crossing's own version, `target` the one it lands on, `flipped` whether the own version was flipped away from (its cap frozen). */
export const cardLine = (
  c: Crossing,
  nowSeconds: number,
  version: string,
  flipped = false,
  target = `V${c.target ?? '?'}`,
): CardLine =>
  (LINES[c.state] ?? (() => ({ word: c.state, sentence: kindNoun(c), tone: 'quiet' as const })))(
    c,
    nowSeconds,
    version,
    flipped,
    target,
  );

/** A send-ahead held on Ethereum for longer than this asks whether something is wrong. */
export const TAKING_LONG_AFTER_MS = 6 * 3600 * 1000;

export const takingLong = (c: Crossing, now: number): boolean =>
  c.kind === 2 && c.state === 'held' && now - c.updatedAt > TAKING_LONG_AFTER_MS;

// ---------------------------------------------------------------- the journal card's vocabulary

/** The Ethereum network's everyday name, from the portal's chain id. */
export const chainName = (chainId: string | undefined): string => {
  if (chainId === '1') return 'Ethereum';
  if (chainId === '11155111') return 'Sepolia';
  if (chainId === '31337') return 'anvil';
  return chainId ? `chain ${chainId}` : 'Ethereum';
};

/** "18:52 · Sep 11", in UTC: when a crossing started. */
export const stamp = (ms: number): string => {
  const d = new Date(ms);
  const day = d.toLocaleString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
  return `${d.toISOString().slice(11, 16)} · ${day}`;
};

/** The card's border from the line's tone. */
export const journalTone = (t: Tone): 'neutral' | 'on' | 'ok' | 'warn' | 'bad' =>
  t === 'busy' ? 'on' : t === 'good' ? 'ok' : t === 'quiet' ? 'neutral' : t;

/** Where a crossing goes, beside its amount. */
export const whoOf = (c: Crossing, short: (a: string) => string, target = `V${c.target ?? '?'}`): string => {
  if (c.kind === 1) return `to Ethereum · Ξ ${short(c.ethAddress)}`;
  if (c.kind === 3) return `from Ethereum · Ξ ${short(c.ethAddress)}`;
  return c.target ? `sent ahead · to ${target}` : 'sent ahead · to the next version';
};

const st = (label: string, state: TrailItem['state']): TrailItem => ({ label, state });
const blockStation = (c: Crossing): TrailItem =>
  st(c.block ? `block ${c.block.toLocaleString('en-US')}` : 'a block', c.block ? 'done' : 'todo');
/** Burned, in a block, proven to Ethereum, then `last`: the exit's road up to where it stands. */
const exitTrail = (c: Crossing, last: TrailItem): TrailItem[] => [
  st('burned', 'done'),
  blockStation(c),
  st('proven to Ethereum', 'done'),
  last,
];
const DEPOSIT_TRAIL: Partial<Record<CrossingState, TrailItem[]>> = {
  proving: [st('your wallet', 'on'), st('deposited', 'todo'), st('crossing', 'todo'), st('claim', 'todo')],
  sent: [st('deposited', 'done'), st('crossing', 'on'), st('claim', 'todo'), st('minted', 'todo')],
  deposited: [
    st('deposited', 'done'),
    st('crossing to Aztec', 'on'),
    st('claim', 'todo'),
    st('minted', 'todo'),
  ],
  dropped: [st('not sent', 'bad')],
  claimable: [st('deposited', 'done'), st('crossed', 'done'), st('claim', 'on'), st('minted', 'todo')],
  'minted-l2': [st('deposited', 'done'), st('crossed', 'done'), st('claimed', 'done'), st('minted', 'done')],
};

/** The stations of a crossing, for the journal card's rail: what is behind it, where it is, what is left. */
export function trailOf(c: Crossing, target = `V${c.target ?? '?'}`): TrailItem[] {
  if (c.kind === 3) return DEPOSIT_TRAIL[c.state] ?? [];
  const deadline = c.proofDeadline ? ` · by ${hhmm(c.proofDeadline)}` : '';
  const end = c.kind === 1 ? 'claimed on Ethereum' : 'held on Ethereum';
  switch (c.state) {
    case 'proving':
      return [st('proving', 'on'), st('proven to Ethereum', 'todo'), st(end, 'todo')];
    case 'sent':
      return [st('burned', 'done'), blockStation(c), st('proven to Ethereum', 'todo'), st(end, 'todo')];
    case 'dropped':
      return [st('burned', 'done'), st('not included', 'bad')];
    case 'proven-pending':
      return [st('burned', 'done'), blockStation(c), st(`proving${deadline}`, 'on'), st(end, 'todo')];
    case 'witnessed':
      return exitTrail(c, st(c.kind === 1 ? 'claim on Ethereum' : 'held on Ethereum', 'todo'));
    case 'ready':
      return exitTrail(c, st('claim on Ethereum', 'on'));
    case 'never-proven':
      return [st('burned', 'done'), st(`not proven${deadline}`, 'bad')];
    case 'paused':
      return exitTrail(c, st('paused', 'warn'));
    case 'headroom':
      return exitTrail(c, st('waiting for the limit', 'warn'));
    case 'closed':
      return exitTrail(c, st('last day passed', 'bad'));
    case 'minted-l1':
      return exitTrail(c, st(c.kind === 2 ? 'redeemed as YACA' : 'claimed on Ethereum', 'done'));
    case 'held':
      return exitTrail(c, st('waiting for the next version', 'on'));
    case 'not-registered':
      return exitTrail(c, st('waiting for Yacana on the next version', 'on'));
    case 'forwarded':
      return [...exitTrail(c, st('forwarded', 'done')), st(`claim on ${target}`, 'on')];
    case 'claimable':
      return [...exitTrail(c, st('forwarded', 'done')), st('claim', 'on')];
    case 'minted-l2':
      return [...exitTrail(c, st('forwarded', 'done')), st('minted', 'done')];
    default:
      return [];
  }
}
