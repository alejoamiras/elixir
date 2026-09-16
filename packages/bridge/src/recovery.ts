// The recovery file: a wallet's crossings and their witnesses, bound to one chain and portal, so
// a device that lost its journal (or a browser that cleared it) restores the records and refreshes
// their states from the chain. Nothing secret is in it: secrets re-derive from the master.
import type { Hex } from 'viem';
import { type Crossing, type CrossingState, crossingId, FINAL_STATES } from './journal.ts';
import { type ArchivedExit, parseArchivedExit } from './witness.ts';

export const RECOVERY_VERSION = 1;

export interface RecoveryFile {
  v: typeof RECOVERY_VERSION;
  chainId: string;
  portal: Hex;
  /** The account the crossings belong to (its Aztec address on the version that made them). */
  account: string;
  exportedAt: number;
  crossings: Crossing[];
}

export const recoveryFile = (
  scope: { chainId: string; portal: Hex; account: string },
  crossings: Crossing[],
  now = Date.now(),
): RecoveryFile => ({
  v: RECOVERY_VERSION,
  ...scope,
  portal: scope.portal.toLowerCase() as Hex,
  exportedAt: now,
  crossings,
});

const STATES: ReadonlySet<string> = new Set<CrossingState>([
  'proving',
  'sent',
  'dropped',
  'proven-pending',
  'witnessed',
  'never-proven',
  'paused',
  'headroom',
  'closed',
  'ready',
  'minted-l1',
  'held',
  'not-registered',
  'forwarded',
  'deposited',
  'claimable',
  'minted-l2',
]);
const HEX20 = /^0x[0-9a-f]{40}$/i;
const DECIMAL = /^(0|[1-9][0-9]*)$/;
/** A file's index sets how far a device scans for arrivals; no account reaches this many crossings. */
export const MAX_INDEX = 1_000_000;

const fail = (where: string, what: string): never => {
  throw new Error(`${where}: ${what}`);
};

/** One crossing as the file spells it, checked field by field; `witness` through the archive's own check. */
export function parseCrossing(raw: unknown, where: string): Crossing {
  if (typeof raw !== 'object' || raw === null) fail(where, 'not an object');
  const o = raw as Record<string, unknown>;
  const str = (k: string, re?: RegExp): string =>
    typeof o[k] === 'string' && (!re || re.test(o[k])) ? o[k] : fail(where, `${k} is missing or malformed`);
  const num = (k: string): number =>
    typeof o[k] === 'number' && Number.isSafeInteger(o[k]) && o[k] >= 0
      ? o[k]
      : fail(where, `${k} is not a whole number`);
  const kind = num('kind');
  if (kind !== 1 && kind !== 2 && kind !== 3) fail(where, `kind ${kind}`);
  const state = str('state');
  if (!STATES.has(state)) fail(where, `state ${state}`);
  const c: Crossing = {
    id: '',
    kind: kind as Crossing['kind'],
    chainId: str('chainId', DECIMAL),
    portal: str('portal', HEX20).toLowerCase() as Hex,
    version: str('version', DECIMAL),
    index: num('index') <= MAX_INDEX ? num('index') : fail(where, `index past ${MAX_INDEX}`),
    amount: str('amount', DECIMAL),
    state: state as CrossingState,
    createdAt: num('createdAt'),
    updatedAt: num('updatedAt'),
    ethAddress: str('ethAddress', HEX20).toLowerCase() as Hex,
  };
  c.id = crossingId(c);
  optionalFields(o, c, num);
  // A twin (another message under one index) keeps the id its message gave it: the crossing's id, then a suffix.
  if (typeof o.id === 'string' && o.id.startsWith(`${c.id}:`)) c.id = o.id;
  else if (o.id !== undefined && o.id !== c.id) fail(where, `id ${String(o.id)} is not ${c.id}`);
  if (o.witness !== undefined) {
    const w = parseArchivedExit(o.witness, `${where}.witness`) as ArchivedExit;
    if (!describes(w, c)) fail(where, 'witness does not describe this crossing');
    c.witness = w;
  }
  return c;
}

/** The fields a crossing carries once it moved: taken as typed, never required. */
function optionalFields(o: Record<string, unknown>, c: Crossing, num: (k: string) => number): void {
  const strings = [
    'txHash',
    'expiresAt',
    'epoch',
    'proofDeadline',
    'target',
    'inboxIndex',
    'l1TxHash',
    'claimTxHash',
    'recipient',
    'error',
  ] as const;
  for (const k of strings) if (typeof o[k] === 'string') (c as unknown as Record<string, unknown>)[k] = o[k];
  for (const k of ['block', 'claimBlock', 'anchorBlock'] as const)
    if (typeof o[k] === 'number') c[k] = num(k);
  if (o.claimSettled === true) c.claimSettled = true;
}

/** The card shows the crossing's fields; the signature covers the witness's. They must be one thing. */
const describes = (w: ArchivedExit, c: Crossing): boolean =>
  w.kind === c.kind &&
  w.version === c.version &&
  w.index === c.index &&
  w.amount === c.amount &&
  w.recipientOrRedeemKey.toLowerCase() === c.ethAddress;

/** A recovery file is a few kilobytes per crossing; anything past this is not one. */
export const MAX_RECOVERY_BYTES = 8 * 1024 * 1024;

/**
 * The file's crossings for this chain and portal; a file for another deployment is refused, not
 * merged (its indices would collide with this one's).
 */
export function parseRecoveryFile(text: string, expected: { chainId: string; portal: Hex }): RecoveryFile {
  if (text.length > MAX_RECOVERY_BYTES) fail('recovery file', `${text.length} bytes is too large to be one`);
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch (e) {
    fail('recovery file', `not JSON: ${e instanceof Error ? e.message : e}`);
  }
  const o = json as Record<string, unknown>;
  if (typeof o !== 'object' || o === null) fail('recovery file', 'not an object');
  if (o.v !== RECOVERY_VERSION) fail('recovery file', `version ${String(o.v)} is not ${RECOVERY_VERSION}`);
  if (o.chainId !== expected.chainId || String(o.portal).toLowerCase() !== expected.portal.toLowerCase())
    fail(
      'recovery file',
      `for chain ${String(o.chainId)} and portal ${String(o.portal)}, not this deployment`,
    );
  if (typeof o.account !== 'string' || !Array.isArray(o.crossings))
    fail('recovery file', 'no account or crossings');
  const portal = expected.portal.toLowerCase() as Hex;
  const crossings = (o.crossings as unknown[]).map((c, i) => {
    const parsed = parseCrossing(c, `recovery file crossing ${i}`);
    if (parsed.chainId !== expected.chainId || parsed.portal !== portal)
      fail(`recovery file crossing ${i}`, 'not of this deployment');
    return parsed;
  });
  return {
    v: RECOVERY_VERSION,
    chainId: expected.chainId,
    portal,
    account: o.account as string,
    exportedAt: typeof o.exportedAt === 'number' ? o.exportedAt : 0,
    crossings,
  };
}

/**
 * A restored crossing's state is a hint, never a verdict: an ended state is imported as the
 * furthest state its own fields can be read from, and the chain says again how it ended. A file
 * cannot hide a live crossing that way, and no record lands where no read moves it. The send's
 * expiry is dropped too: only a page that observed the send may let it authorise "didn't finish"
 * (the file's device may have been behind), so a restored send without a hash stays `checking`.
 */
export function asHint(c: Crossing): Crossing {
  const { expiresAt: _expiresAt, anchorBlock: _anchorBlock, ...observed } = c;
  if (!FINAL_STATES.has(c.state)) return observed;
  return { ...observed, state: readableFrom(c), claimSettled: undefined };
}

const readableFrom = (c: Crossing): CrossingState => {
  if (c.kind === 3) return c.inboxIndex ? 'deposited' : 'proving';
  if (c.kind === 2 && c.inboxIndex && c.target) return 'forwarded';
  if (c.witness) return 'witnessed';
  if (c.epoch || c.block !== undefined) return 'proven-pending';
  return c.txHash ? 'sent' : 'proving';
};
