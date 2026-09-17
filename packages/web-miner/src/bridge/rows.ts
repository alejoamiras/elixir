// The Wallet's one reading of the journal: the badge's count, each row's action and the money
// buttons' reasons derive together here, so none can disagree with the rows under it.
import { dayOf, deadlinePhrase } from '../../../bridge/src/exit-deadline.ts';
import {
  type Crossing,
  destinationOf,
  FADE_AFTER_MS,
  inFlight,
  type RowState,
} from '../../../bridge/src/journal.ts';
import { PARAMS } from '../../../miner-core/src/generated/params.ts';
import type { RowLine } from '../../../ui/src/index.ts';
import { amount as fmt, shortAddress } from '../lib/format';
import type { ProverKind } from '../presto';
import type { BridgeView, VersionFacts } from '../state';
import { chainName, rowLine, stamp, takingLong, whoOf } from './copy';
import { isOldRole, lifecycleRecord, nextVersionName, versionNameOf } from './env';

/** YACA on Ethereum; the private token here keeps the profile's symbol. */
const L1_SYMBOL = 'YACA';

/** The unit the amount is printed in: the side the money is on when the crossing starts. */
const unitOf = (c: Crossing): string => (c.kind === 3 ? L1_SYMBOL : PARAMS.TOKEN_SYMBOL);

export interface ActivityRowView {
  c: Crossing;
  line: RowLine;
  amount: string;
  unit: string;
  direction: string;
  when: string;
  /** Past its week: the row keeps its place and its amount, folded to one line. */
  collapsed: boolean;
  /** The version's last day as Details tell it, while an exit or a send-ahead is still on its way out. */
  deadline?: string;
}

export interface ActivityView {
  rows: ActivityRowView[];
  /** Rows waiting on the user — the Wallet tab's badge and the list's aside. */
  needsUser: number;
}

/** A held send-ahead is forwarded from the version it lands on: the live one, never the old origin. */
const mayForward = (c: Crossing, view: BridgeView, ownVersion: string): boolean =>
  c.kind === 2 &&
  !isOldRole() &&
  view.canonical !== undefined &&
  view.canonical.version !== BigInt(c.version) &&
  view.canonical.version === BigInt(ownVersion);

/** The version after which a crossing's last day is measured: the live one once flipped, else whatever is announced. */
const afterOf = (view: BridgeView, flipped: boolean): string =>
  flipped ? versionNameOf(view.canonical?.version, view.canonical) : nextVersionName(view.canonical);

/**
 * Where a crossing lands, by name. A send-ahead lands on the first version after its own: the one
 * it was forwarded to, else the canonical once that is another than the crossing's, else whatever
 * is announced.
 */
export const targetOf = (c: Crossing, view: BridgeView, flipped: boolean): string => {
  if (c.kind === 1) return 'Ethereum';
  if (c.target) return versionNameOf(c.target, view.canonical);
  return afterOf(view, flipped);
};

/** Seconds since the row's own work began: a proof since the send, a claim since the tap. */
const elapsedOf = (
  c: Crossing,
  state: RowState,
  now: number,
  since: number | undefined,
): number | undefined => {
  if (since !== undefined) return (now - since) / 1000;
  return state === 'proving' ? (now - c.createdAt) / 1000 : undefined;
};

/** The Ethereum party a sentence names; a redeem's recipient only once the record knows it. */
const partyOf = (c: Crossing): string | undefined =>
  c.kind === 2 ? (c.recipient ? shortAddress(c.recipient) : undefined) : shortAddress(c.ethAddress);

/**
 * The standing and deadline a crossing is judged under: its own version's. A V5 send viewed on V6
 * waits for V5's proof, under the limit V5 froze at the upgrade, until V5's last day.
 */
const factsOf = (c: Crossing, view: BridgeView, ownVersion: string): Partial<VersionFacts> | undefined =>
  c.version === ownVersion
    ? { deadline: view.deadline, standing: view.standing }
    : view.versions?.[c.version];

/** The name of the version an arrival lands on when that is not this build: it is claimed there. */
const elsewhereOf = (c: Crossing, view: BridgeView, ownVersion: string): string | undefined => {
  const destination = destinationOf(c);
  return destination !== undefined && destination !== ownVersion
    ? versionNameOf(destination, view.canonical)
    : undefined;
};

/**
 * A row waits on the user when its button is the way forward. A forward or a redeem on a row that
 * is merely on its way is an option beside Yacana's own forward, not a need.
 */
const waitsOnUser = (line: RowLine): boolean =>
  line.action !== undefined &&
  line.action.disabled === undefined &&
  line.action.kind !== 'settings' &&
  !(line.chip.tone === 'on' && (line.action.kind === 'forward' || line.action.kind === 'redeem'));

interface Env {
  ownVersion: string;
  chainId?: string;
  /** The private claims under way here, by crossing id, with when each tap came. */
  claiming?: ReadonlyMap<string, number>;
  /** Who proves this page's next transaction; the browser when unknown. */
  prover?: ProverKind;
  /** Who proved a claim under way, by crossing id: that row's answer over the page's promise. */
  provers?: ReadonlyMap<string, ProverKind>;
}

/**
 * Every crossing as its row, newest first. The whole journal is here — an exit, a send-ahead and a
 * deposit are one list (a crossing appears once, whichever way it goes), and a finished row is
 * folded rather than dropped: a record the user can still read is the only account of where money
 * went.
 */
export function activity(
  journal: readonly Crossing[],
  view: BridgeView,
  now: number,
  states: Readonly<Record<string, RowState>>,
  env: Env,
): ActivityView {
  const chain = chainName(env.chainId);
  const registeredAt = view.targetRegisteredAt === undefined ? undefined : Number(view.targetRegisteredAt);
  const stopped =
    lifecycleRecord()?.stoppedProvingAt === undefined
      ? undefined
      : versionNameOf(env.ownVersion, view.canonical);
  const rows = [...journal]
    .sort((a, b) => b.createdAt - a.createdAt)
    .map((c): ActivityRowView => {
      const state = states[c.id] ?? c.state;
      const version = versionNameOf(c.version, view.canonical);
      const flipped = view.canonical !== undefined && view.canonical.version !== BigInt(c.version);
      const own = factsOf(c, view, env.ownVersion);
      const target = targetOf(c, view, flipped);
      const since = env.claiming?.get(c.id);
      const money = `${fmt(BigInt(c.amount), PARAMS.DECIMALS)} ${state === 'minted-l1' ? L1_SYMBOL : PARAMS.TOKEN_SYMBOL}`;
      const line = rowLine(c, {
        state,
        version,
        target,
        flipped,
        deadline: own?.deadline,
        // Before the flip the canonical is the source itself: its registration is not the destination's.
        takingLong: takingLong(c, now, flipped ? registeredAt : undefined),
        pausedUntil: own?.standing?.paused ? own.standing.pausedUntil : undefined,
        mayForward: mayForward(c, view, env.ownVersion),
        verdictUnknown: view.verdict.kind === 'unknown' || view.rpcFailing,
        claiming: since !== undefined,
        elapsed: elapsedOf(c, state, now, since),
        prover: env.provers?.get(c.id) ?? env.prover,
        elsewhere: elsewhereOf(c, view, env.ownVersion),
        money,
        who: partyOf(c),
        chain,
        stopped,
      });
      return {
        c,
        line,
        amount: fmt(BigInt(c.amount), PARAMS.DECIMALS),
        unit: unitOf(c),
        direction: whoOf(c, shortAddress, target),
        when: stamp(c.createdAt),
        collapsed: line.chip.tone === 'dim' && now - c.updatedAt > FADE_AFTER_MS,
        deadline:
          c.kind !== 3 && inFlight(c) ? deadlinePhrase(own?.deadline, afterOf(view, flipped)) : undefined,
      };
    });
  return { rows, needsUser: rows.filter((r) => waitsOnUser(r.line)).length };
}

/** The wallet's money buttons; `Send` is Aztec's alone and no bridge standing can stop it. */
export type MoneyAction = 'to-ethereum' | 'deposit';

export interface MoneyStanding {
  /** The buttons that cannot run now. */
  off: ReadonlySet<MoneyAction>;
  /** The one line under the button row saying why, when there is something to say. */
  reason?: string;
  /** The reason ends in a link to Settings: the RPC is the user's to change. */
  settings?: boolean;
}

const BOTH: ReadonlySet<MoneyAction> = new Set<MoneyAction>(['to-ethereum', 'deposit']);
const DEPOSIT_ONLY: ReadonlySet<MoneyAction> = new Set<MoneyAction>(['deposit']);

/**
 * Why a money button is off, in the order the reasons overrule each other: a silent RPC is first
 * because nothing else is known then, and a pause is last because it stops the least — a bridge to
 * Ethereum can start under one, and only its claim waits.
 */
export function moneyStanding(view: BridgeView, version: string, next: string): MoneyStanding {
  if (view.rpcFailing)
    return {
      off: BOTH,
      reason: "The Ethereum RPC isn't answering: bridging waits until it does.",
      settings: true,
    };
  const s = view.standing;
  if (!s?.registered)
    return {
      off: BOTH,
      reason: `Bridging opens once Yacana registers ${version} on Ethereum, at launch.`,
    };
  if (s.depositsClosed)
    return {
      off: DEPOSIT_ONLY,
      reason: `Deposits into ${version} are closed for good. Bridge from Ethereum on ${next}, at yacana.network, once it opens.`,
    };
  if (s.paused)
    return {
      off: DEPOSIT_ONLY,
      reason: `The bridge is paused${s.pausedUntil ? ` until ${dayOf(s.pausedUntil)}` : ''}: deposits wait until it lifts, and so do claims on Ethereum. A bridge to Ethereum can start now; its claim waits.`,
    };
  return { off: new Set() };
}
