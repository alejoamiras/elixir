// What the activity row says, one sentence per state of each kind of crossing. Every sentence names
// what happened to the money and, where a wait has a clock, whose clock it is; none of them says
// "safe". An exit ends with its holder's claim on Ethereum (anyone may make it); a send-ahead is
// forwarded by Yacana, its holder or an authorized relayer, or redeemed. The only promised time is
// the proof's, because it is the only one a contract enforces.
import type { DeadlineReading } from '../../../bridge/src/exit-deadline.ts';
import type { Crossing, RowState } from '../../../bridge/src/journal.ts';
import { policyFor } from '../../../bridge/src/policy.ts';
import { revertRow } from '../../../bridge/src/revert.ts';
import type { ChipTone, RowAction, RowLine, TrailItem } from '../../../ui/src/index.ts';
import { duration } from '../lib/format';

/** Seconds until `deadline` (unix s), as "in 12 min" or "3 h ago". */
export const untilOrAgo = (deadline: bigint, nowSeconds: number): string => {
  const delta = Number(deadline) - nowSeconds;
  return delta >= 0 ? `in ${duration(delta)}` : `${duration(-delta)} ago`;
};

const hhmm = (unixSeconds: string | bigint): string =>
  new Date(Number(unixSeconds) * 1000).toISOString().slice(11, 16);

/** "Sep 20", in UTC: a date the user is told to expect, never a time of day. */
export const dayOf = (unixSeconds: bigint): string =>
  new Date(Number(unixSeconds) * 1000).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });

/** "18:52 · Sep 11", in UTC: when a crossing started. */
export const stamp = (ms: number): string =>
  `${new Date(ms).toISOString().slice(11, 16)} · ${dayOf(BigInt(Math.floor(ms / 1000)))}`;

/** The Ethereum network's everyday name, from the portal's chain id. */
export const chainName = (chainId: string | undefined): string => {
  if (chainId === '1') return 'Ethereum';
  if (chainId === '11155111') return 'Sepolia';
  if (chainId === '31337') return 'anvil';
  return chainId ? `chain ${chainId}` : 'Ethereum';
};

/** A held send-ahead nobody has forwarded for longer than this asks whether something is wrong. */
export const TAKING_LONG_AFTER_MS = 6 * 3600 * 1000;

/** Counted from the later of being held and the target's registration: nothing is long while the target has no contract. */
export const takingLong = (c: Crossing, now: number, targetRegisteredAt: number | undefined): boolean =>
  c.kind === 2 &&
  c.state === 'held' &&
  targetRegisteredAt !== undefined &&
  now - Math.max(c.updatedAt, targetRegisteredAt * 1000) > TAKING_LONG_AFTER_MS;

export interface RowFacts {
  /** The row's state this refresh: the record's, or what a send with no hash reads as. */
  state: RowState;
  /** The crossing's own version ("V5") and the one it lands on ("V6"); an exit lands on Ethereum. */
  version: string;
  target: string;
  /** The own version was flipped away from: its exit limit and its last day froze at the upgrade. */
  flipped: boolean;
  /** The own version's last day, as the portal reads it now. */
  deadline?: DeadlineReading;
  /** Nobody has forwarded this held send-ahead for six hours. */
  takingLong?: boolean;
  /** The pause's end, when the portal is paused. */
  pausedUntil?: bigint;
  /** A forward runs only from the version it lands on, with a wallet there. */
  mayForward?: boolean;
  /** Ethereum could not be read, so which side of the upgrade the version is on is unknown. */
  verdictUnknown?: boolean;
  /** This page is proving the claim right now: not a journal state, the tap's own progress. */
  claiming?: boolean;
  /** The amount in the unit of where it lands: what the sentence says it becomes ("3.5 tYACA"). */
  money: string;
  /** The Ethereum party, shortened for a sentence ("0x90F7…b906"). */
  who: string;
  /** The Ethereum network the claim needs a wallet on ("Sepolia"). */
  chain: string;
  /** The Ethereum wallet's own name, when one is connected ("Rabby"). */
  wallet: string;
}

const POLICY = policyFor();
const FLOOR_DAYS = Number(POLICY.exitFloor / 86_400n);
const PAUSE_BUDGET_DAYS = Number(POLICY.pauseBudget / 86_400n);

/**
 * The version's last day, in the four readings the portal allows. Never a bare date while the
 * upgrade after the next one is unrecorded: that observation can still push the date out, and every
 * paused day pushes it further — so the phrase says what is guaranteed and what could extend it.
 */
export const deadlinePhrase = (d: DeadlineReading | undefined, after: string): string => {
  if (!d) return 'while the bridge is open';
  if (d.kind === 'no-flip') return `for at least ${FLOOR_DAYS} days after the upgrade`;
  if (d.kind === 'floor')
    return `until at least ${dayOf(d.until)} (${FLOOR_DAYS} days after the upgrade); after that day, until the upgrade after ${after} lands`;
  if (d.kind === 'any-day') return 'until the next Aztec upgrade, which could land any day';
  return `until ${dayOf(d.at)} (the upgrade after ${after} has already landed; later only by the days the bridge was paused)`;
};

/** Past the floor with no upgrade after the next one observed: the exits can close on any day now. */
const anyDay = (f: RowFacts): boolean => f.deadline?.kind === 'any-day';

const chip = (word: string, tone: ChipTone) => ({ word, tone });
const st = (label: string, state: TrailItem['state']): TrailItem => ({ label, state });
const act = (kind: RowAction, label: string, disabled?: string) => ({ kind, label, disabled });

/** The proof's due time once the journal knows the epoch's deadline; without it, only the rule. */
const provenBy = (c: Crossing, f: RowFacts): string =>
  c.proofDeadline
    ? `${f.version} must prove it by ${hhmm(c.proofDeadline)}, or the balance comes back here`
    : `${f.version} must prove it in time, or the balance comes back here`;

const blockStation = (c: Crossing): TrailItem =>
  st(c.block ? `block ${c.block.toLocaleString('en-US')}` : 'a block', c.block ? 'done' : 'todo');

/** Sent, in a block, reached Ethereum, then where it stands: an exit's or a send-ahead's road. */
const road = (c: Crossing, last: TrailItem[]): TrailItem[] => [
  st('sent', 'done'),
  blockStation(c),
  st('reached Ethereum', 'done'),
  ...last,
];

const aheadEnd = (f: RowFacts): TrailItem[] => [
  st(`forwarded to ${f.target}`, 'todo'),
  st(`claim on ${f.target}`, 'todo'),
];

/** "Bridge again" on an exit or a deposit; a send-ahead is sent ahead again. */
const againOf = (c: Crossing) => act('again', c.kind === 2 ? 'Send ahead again' : 'Bridge again');

const REDEEM = act('redeem', 'Redeem on Ethereum');

type Line = (c: Crossing, f: RowFacts) => RowLine;

const proving: Line = (c, f) =>
  c.kind === 3
    ? {
        chip: chip(`waiting for ${f.wallet}`, 'on'),
        sentence: `Confirm the deposit in ${f.wallet}. Nothing leaves your wallet until you do.`,
        trail: [
          st('your wallet', 'on'),
          st('deposited', 'todo'),
          st('crossing', 'todo'),
          st('claim', 'todo'),
        ],
      }
    : {
        chip: chip('proving', 'on'),
        sentence: 'Proving privately, about 20 s.',
        trail: [st('proving', 'on'), st('reached Ethereum', 'todo'), st(`claim on ${f.target}`, 'todo')],
      };

const dropped: Line = (c, f) => ({
  chip: chip(c.kind === 3 ? 'not sent' : 'not included', 'warn'),
  sentence:
    c.kind === 3
      ? `${f.wallet} never sent it, or Ethereum didn't include it in time. No YACA left your wallet; if it was sent, the gas is spent.`
      : 'The node never included it. Nothing left your balance.',
  trail: c.kind === 3 ? [st('not sent', 'bad')] : [st('sent', 'done'), st('not included', 'bad')],
  action: againOf(c),
});

const headroom: Line = (c, f) =>
  f.flipped
    ? {
        chip: chip('over the limit', 'bad'),
        sentence: `${f.version}'s exit limit froze at the upgrade, and this is beyond it. It cannot ${c.kind === 2 ? 'be forwarded or redeemed' : 'leave'}.`,
        trail: road(c, [st('over the limit', 'bad')]),
        action: act('details', 'Details'),
      }
    : {
        chip: chip('waiting for the limit', 'warn'),
        sentence:
          c.kind === 2
            ? `More has left ${f.version} than its exit limit allows right now. The limit grows by the hour until the upgrade; a redeem waits for room the same way, and the forward comes after the upgrade.`
            : `More has left ${f.version} than its exit limit allows right now. The limit grows by the hour while ${f.version} is current, and this turns ready to claim once it fits; others may use the room first.`,
        trail: road(c, [st('waiting for the limit', 'warn')]),
      };

const ready: Line = (c, f) => ({
  ...(anyDay(f)
    ? {
        chip: chip('could close any day', 'bad'),
        sentence: `The ${FLOOR_DAYS} days are over. The next Aztec upgrade closes ${f.version}'s exits, later only by the days the bridge was paused. Claim it now.`,
      }
    : {
        chip: chip('ready to claim', 'ok'),
        sentence: `Ready. Claim it on Ethereum with a wallet on ${f.chain}; that wallet pays the gas in ETH.`,
      }),
  trail: road(c, [st('claim on Ethereum', 'on')]),
  action: act('claim-l1', 'Claim on Ethereum'),
});

const ALSO_REDEEM = { kind: 'redeem' as const, label: 'or redeem it on Ethereum' };

/**
 * A send-ahead on Ethereum: Yacana's to forward, the holder's to forward from the target, or to
 * redeem. The forward is the button where this page can make it; the redeem is the button only
 * when nothing else is on offer, and the quiet link otherwise.
 */
const held: Line = (c, f) => {
  const forward = f.mayForward ? act('forward', `Forward to ${f.target}`) : undefined;
  const ways = forward ? { action: forward, also: ALSO_REDEEM } : { action: REDEEM };
  if (anyDay(f))
    return {
      chip: chip('could close any day', 'bad'),
      sentence: `The ${FLOOR_DAYS} days are over. The next Aztec upgrade closes ${f.version}'s exits, later only by the days the bridge was paused. Forward it from ${f.target} or redeem it now.`,
      trail: road(c, [st(`held for ${f.target}`, 'bad'), ...aheadEnd(f)]),
      ...ways,
    };
  if (f.takingLong)
    return {
      chip: chip('longer than usual', 'warn'),
      sentence: `Yacana hasn't forwarded it yet. Forward it yourself from ${f.target}, or check the Ethereum RPC in Settings.`,
      trail: road(c, [st(`held for ${f.target}`, 'warn'), ...aheadEnd(f)]),
      ...ways,
    };
  return {
    chip: chip(`held for ${f.target}`, 'on'),
    sentence: `Held on Ethereum for ${f.target}, out of ${f.version}'s reach. Yacana forwards it into ${f.target} once ${f.target} opens; you can too, from ${f.target}.`,
    trail: road(c, [st(`held for ${f.target}`, 'on'), ...aheadEnd(f)]),
    action: forward,
    also: { kind: 'redeem', label: 'Or redeem it on Ethereum' },
    note: `as YACA, ${deadlinePhrase(f.deadline, f.target)}.`,
  };
};

/** Arrived and unclaimed. A claim made once and undone by a pruned epoch says so: its hash is still on the record. */
const claimable: Line = (c, f) => {
  const trail =
    c.kind === 3
      ? [st('sent from your wallet', 'done'), st('crossed to Aztec', 'done'), st('claim', 'on')]
      : [st(`left ${f.version}`, 'done'), st('reached Ethereum', 'done'), st('claim', 'on')];
  if (f.claiming)
    return {
      chip: chip('claiming', 'on'),
      sentence: 'Claiming privately, about 20 s.',
      trail,
    };
  return {
    chip: chip('ready to claim', 'ok'),
    sentence: c.claimTxHash
      ? "The claim's epoch wasn't proven in time, so the claim was undone. Claim it again: one tap."
      : c.kind === 3
        ? 'Arrived. Claim it into your private balance: one tap, about 20 s, no fee.'
        : `Arrived from ${f.version}. Claim it into your balance: one tap, about 20 s, no fee.`,
    trail,
    action: act('claim', 'Claim'),
  };
};

const LINES: Record<RowState, Line> = {
  proving,
  checking: () => ({
    chip: chip('checking', 'on'),
    sentence: 'The page closed while this was sent. Checking the chain for it.',
    trail: [st('sent', 'on'), st('reading the chain', 'on')],
  }),
  unfinished: (c) => ({
    chip: chip("didn't finish", 'warn'),
    sentence: "This didn't finish. Nothing left your balance.",
    trail: [st("didn't finish", 'bad')],
    action: againOf(c),
  }),
  sent: (c) => ({
    chip: chip('sent', 'on'),
    sentence: 'Sent. Waiting for a block.',
    trail:
      c.kind === 3
        ? [st('deposited', 'done'), st('crossing to Aztec', 'on'), st('claim', 'todo')]
        : [st('sent', 'done'), blockStation(c), st('reached Ethereum', 'todo')],
  }),
  dropped,
  'proven-pending': (c, f) => ({
    chip: chip('reaching Ethereum', 'on'),
    sentence: `Reaches Ethereum usually within the hour; then ${c.kind === 1 ? 'you claim it there' : `held there for ${f.target}`}. ${provenBy(c, f)}.`,
    trail: [st('sent', 'done'), blockStation(c), st('reaching Ethereum', 'on')],
  }),
  witnessed: (c, f) =>
    c.kind === 1
      ? {
          chip: chip('reached Ethereum', 'on'),
          sentence: 'Reached Ethereum; reading the bridge for the claim.',
          trail: road(c, [st('claim on Ethereum', 'todo')]),
        }
      : held(c, f),
  'never-proven': (c, f) => ({
    chip: chip('undone', 'warn'),
    sentence: `${f.version} didn't prove this in time. The balance is back here.`,
    trail: [st('sent', 'done'), st('not proven', 'bad')],
    action: againOf(c),
  }),
  paused: (c, f) => ({
    chip: chip(f.pausedUntil ? `paused · until ${dayOf(f.pausedUntil)}` : 'paused', 'warn'),
    sentence: `The bridge is paused${f.pausedUntil ? ` until ${dayOf(f.pausedUntil)}` : ''}: claims wait until it lifts. Yacana can pause for ${PAUSE_BUDGET_DAYS} days in all over ${f.version}'s life, and can lift a pause early.`,
    trail: road(c, [st('paused', 'warn')]),
  }),
  headroom,
  closed: (c, f) => ({
    chip: chip('last day passed', 'bad'),
    sentence: `${f.version}'s last day passed before this was ${c.kind === 2 ? 'forwarded or redeemed' : 'claimed'}. It cannot leave any more.`,
    trail: road(c, [st('last day passed', 'bad')]),
  }),
  ready,
  'minted-l1': (c, f) => ({
    chip: chip(c.kind === 2 ? 'redeemed' : 'claimed', 'dim'),
    sentence: c.kind === 2 ? `Redeemed: ${f.money} at ${f.who} on Ethereum.` : `${f.money} at ${f.who}.`,
    trail: road(c, [st(c.kind === 2 ? 'redeemed' : 'claimed on Ethereum', 'done')]),
  }),
  held,
  'not-registered': (c, f) => ({
    chip: chip('waiting for Yacana', 'warn'),
    sentence: `${f.target} is live, but Yacana hasn't opened its contract there yet. You can redeem it on Ethereum ${deadlinePhrase(f.deadline, f.target)}.`,
    trail: road(c, [st(`held for ${f.target}`, 'warn'), st(`${f.target} not open yet`, 'todo')]),
    action: REDEEM,
  }),
  forwarded: (_c, f) => ({
    chip: chip('arriving', 'on'),
    sentence: `Forwarded into ${f.target}; claimable there in a few minutes.`,
    trail: [
      st(`left ${f.version}`, 'done'),
      st('reached Ethereum', 'done'),
      st(`forwarded to ${f.target}`, 'done'),
      st('claim', 'todo'),
    ],
  }),
  deposited: (_c, f) => ({
    chip: chip('crossing to Aztec', 'on'),
    sentence: `Sent from ${f.wallet}; crossing to Aztec, a few minutes.`,
    trail: [st('sent from your wallet', 'done'), st('crossing to Aztec', 'on'), st('claim', 'todo')],
  }),
  claimable,
  'minted-l2': (c, f) => ({
    chip: chip('claimed', 'dim'),
    sentence: c.claimSettled
      ? `${f.money} in your balance.`
      : `${f.money} in your balance. Final once its epoch is proven.`,
    trail: [st('claimed', 'done')],
  }),
};

/** The send-ahead states whose sentence turns on which side of the upgrade the version sits. */
const NEEDS_VERDICT: ReadonlySet<RowState> = new Set<RowState>([
  'headroom',
  'witnessed',
  'held',
  'not-registered',
]);

/**
 * What the row says about `c` under the facts read this refresh. Exhaustive over `RowState`, so a
 * new state cannot reach the page without a sentence. A send-ahead whose upgrade nobody could read
 * says that instead of guessing: on the near side of the upgrade it is held for the next version,
 * on the far side its limit is frozen, and nothing in between is true.
 */
export const rowLine = (c: Crossing, f: RowFacts): RowLine =>
  f.verdictUnknown && c.kind === 2 && NEEDS_VERDICT.has(f.state)
    ? {
        chip: chip("can't read the upgrade", 'warn'),
        sentence: "Can't read the upgrade's state: the Ethereum RPC isn't answering.",
        trail: [],
        action: act('settings', 'Settings'),
      }
    : LINES[f.state](c, f);

/**
 * A failed portal call in the words of the row it lands on, for a dialog that has the crossing in
 * hand; undefined when the error is not one of the portal's holder-facing refusals.
 */
export const revertLine = (e: unknown, c: Crossing, f: Omit<RowFacts, 'state'>): string | undefined => {
  const state = revertRow(e);
  return state ? rowLine(c, { ...f, state }).sentence : undefined;
};

/** Where a crossing goes, beside its amount: the direction and the party at the other end. */
export const whoOf = (c: Crossing, short: (a: string) => string, target: string): string => {
  if (c.kind === 1) return `→ Ethereum · ${short(c.ethAddress)}`;
  if (c.kind === 3) return `→ here · from ${short(c.ethAddress)}`;
  return `→ ${target}`;
};
