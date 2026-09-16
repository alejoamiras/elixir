// The Wallet's one reading of the journal: a row per crossing with everything it says, the count of
// rows waiting on the user, and why a money button is off. The count, each row's action and the
// button's reason come from here together, so the badge can never disagree with the rows under it.
import { type Crossing, FADE_AFTER_MS, type RowState } from '../../../bridge/src/journal.ts';
import { PARAMS } from '../../../miner-core/src/generated/params.ts';
import type { RowLine } from '../../../ui/src/index.ts';
import { amount as fmt, shortAddress } from '../lib/format';
import type { BridgeView } from '../state';
import { chainName, dayOf, rowLine, stamp, takingLong, whoOf } from './copy';
import { isOldRole, nextVersionName, versionNameOf } from './env';

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

/**
 * Where a crossing lands, by name. A send-ahead lands on the first version after its own: the one
 * it was forwarded to, else the canonical once that is another than the crossing's, else whatever
 * is announced.
 */
const targetOf = (c: Crossing, view: BridgeView, flipped: boolean): string => {
  if (c.kind === 1) return 'Ethereum';
  if (c.target) return versionNameOf(c.target, view.canonical);
  return flipped ? versionNameOf(view.canonical?.version, view.canonical) : nextVersionName(view.canonical);
};

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
  env: { ownVersion: string; chainId?: string; wallet: string; claiming?: string },
): ActivityView {
  const chain = chainName(env.chainId);
  const registeredAt = view.targetRegisteredAt === undefined ? undefined : Number(view.targetRegisteredAt);
  const rows = [...journal]
    .sort((a, b) => b.createdAt - a.createdAt)
    .map((c): ActivityRowView => {
      const state = states[c.id] ?? c.state;
      const version = versionNameOf(c.version, view.canonical);
      // A crossing is read under its own version's rules: a V5 send viewed on V6 waits for V5's
      // proof, under the limit V5 froze at the upgrade.
      const flipped = view.canonical !== undefined && view.canonical.version !== BigInt(c.version);
      const target = targetOf(c, view, flipped);
      const landedUnit = state === 'minted-l1' ? L1_SYMBOL : PARAMS.TOKEN_SYMBOL;
      const money = `${fmt(BigInt(c.amount), PARAMS.DECIMALS)} ${landedUnit}`;
      const line = rowLine(c, {
        state,
        version,
        target,
        flipped,
        deadline: view.deadline,
        takingLong: takingLong(c, now, registeredAt),
        pausedUntil: view.standing?.paused ? view.standing.pausedUntil : undefined,
        mayForward: mayForward(c, view, env.ownVersion),
        verdictUnknown: view.verdict.kind === 'unknown',
        claiming: env.claiming === c.id,
        money,
        who: shortAddress(c.ethAddress),
        chain,
        wallet: env.wallet,
      });
      return {
        c,
        line,
        amount: fmt(BigInt(c.amount), PARAMS.DECIMALS),
        unit: unitOf(c),
        direction: whoOf(c, shortAddress, target),
        when: stamp(c.createdAt),
        collapsed: line.chip.tone === 'dim' && now - c.updatedAt > FADE_AFTER_MS,
      };
    });
  return { rows, needsUser: rows.filter((r) => r.line.chip.tone === 'ok').length };
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
