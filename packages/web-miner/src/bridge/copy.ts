// What a crossing's card says, per state: the sentence, the action it offers and how it reads. No
// relayer promises, no hour, no waiting period: Yacana forwards by hand and the holder may forward
// or redeem any time.
import type { Crossing, CrossingState } from '../../../bridge/src/journal.ts';
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

type Line = (c: Crossing, nowSeconds: number, version: string, flipped: boolean) => CardLine;

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
  dropped: () => ({
    word: 'dropped',
    sentence: 'The node never included it. Nothing left this account: send again.',
    tone: 'warn',
    action: 'send-again',
  }),
  'proven-pending': (c, now, v) => ({
    word: 'proving to Ethereum',
    sentence: `In a block; Ethereum learns of it when V${v} proves epoch ${c.epoch ?? '?'}${
      c.proofDeadline ? ` — due ${untilOrAgo(BigInt(c.proofDeadline), now)}` : ''
    }, usually within a few epochs.`,
    tone: 'busy',
  }),
  witnessed: () => ({
    word: 'proven',
    sentence: 'Proven to Ethereum; its witness is saved in this wallet.',
    tone: 'busy',
  }),
  'never-proven': (c, _now, v) => ({
    word: 'undone',
    sentence: `V${v} never proved epoch ${c.epoch ?? '?'} in time: the burn was undone and the balance is back on V${v}.`,
    tone: 'warn',
    action: 'send-again',
  }),
  paused: () => ({
    word: 'paused',
    sentence:
      'Nothing of this version moves while the portal is paused, 30 days at most per pause; forward it yourself or redeem it once the pause ends.',
    tone: 'warn',
  }),
  headroom: (_c, _now, _v, flipped) => ({
    word: flipped ? 'over the cap' : 'waiting for headroom',
    sentence: flipped
      ? 'The version’s exit capacity is used up: nothing more of it can be forwarded. Redeem to Ethereum instead.'
      : 'More has left this version than its schedule allows for now; forward or redeem it once the schedule frees room. Nothing queues it.',
    tone: 'warn',
  }),
  closed: (_c, _now, v) => ({
    word: 'closed',
    sentence: `V${v}'s exits closed before this one was forwarded. Gone.`,
    tone: 'bad',
  }),
  ready: () => ({
    word: 'ready',
    sentence: 'Proven; Yacana forwards exits by hand. Forward it yourself any time.',
    tone: 'busy',
    action: 'forward',
  }),
  'minted-l1': (c) => ({
    word: c.kind === 2 ? 'redeemed' : 'on Ethereum',
    sentence: c.kind === 2 ? 'Redeemed: YACA minted on Ethereum.' : 'YACA minted on Ethereum.',
    tone: 'good',
  }),
  held: () => ({
    word: 'held on Ethereum',
    sentence:
      'Held on Ethereum, out of the old version’s reach. Only this account, from this device, or Yacana’s listed forwarder may forward it: a stranger could push it into a rollup about to stop. Redeem to Ethereum any time.',
    tone: 'busy',
    action: 'redeem',
  }),
  'not-registered': () => ({
    word: 'waiting for Yacana',
    sentence:
      'The next version is live; Yacana has not registered its contract there yet. Redeem to Ethereum any time.',
    tone: 'warn',
    action: 'redeem',
  }),
  forwarded: (c) => ({
    word: 'arrived',
    sentence: `On Aztec V${c.target ?? '?'}. Claim it there with this passkey.`,
    tone: 'busy',
  }),
  deposited: () => ({
    word: 'crossing',
    sentence: 'Deposited on Ethereum. Crossing to Aztec: a few minutes.',
    tone: 'busy',
  }),
  claimable: () => ({
    word: 'claim',
    sentence: 'On Aztec. Claim it privately here, about 20 s.',
    tone: 'good',
    action: 'claim',
  }),
  'minted-l2': (c) => ({
    word: 'minted',
    sentence: `Minted here, privately${c.claimTxHash ? '' : ''}.`,
    tone: 'good',
  }),
};

/** The card's line for `c` on this build's version `version`. */
/** `flipped`: the build's version has been flipped away from, so its exit capacity is frozen. */
export const cardLine = (c: Crossing, nowSeconds: number, version: string, flipped = false): CardLine =>
  (LINES[c.state] ?? (() => ({ word: c.state, sentence: kindNoun(c), tone: 'quiet' as const })))(
    c,
    nowSeconds,
    version,
    flipped,
  );

/** A held or ready crossing older than this asks whether something is wrong. */
export const TAKING_LONG_AFTER_MS = 6 * 3600 * 1000;

export const takingLong = (c: Crossing, now: number): boolean =>
  (c.state === 'held' || c.state === 'ready') && now - c.updatedAt > TAKING_LONG_AFTER_MS;
