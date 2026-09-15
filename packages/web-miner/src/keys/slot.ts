// One account per browser profile and origin: the slot names the record that owns it. Its state is
// one key of the `device` store (the database stays at version 1: a new object store would bump it
// and every older build would fail to open), and every change is one transaction over both stores
// with a compare-and-set on the slot's revision, so a decision taken on a stale view is refused
// rather than applied. A build before the slot lists and writes records as it always did: a record
// it adds is unlisted here, a record it deletes leaves a slot that resolves as empty.
import { shortAddress } from '../../../site/src/browser/format.ts';
import { DEVICE, type MasterRecord, RECORDS, request, transaction } from './store.ts';

const SLOT_KEY = 'slot';
/** A tab that reserved the slot and went quiet (closed, crashed) loses its lease after this long. */
export const LEASE_MS = 120_000;
/** This tab, for the lease; tests pass their own. */
export const TAB: string = crypto.randomUUID();

/** `create` and `login` need an empty slot (a login is a restore onto a new device); `open` needs a record. */
export type Intent = 'create' | 'login' | 'open';

interface SlotState {
  v: 1;
  revision: number;
  /** The record that owns the slot. */
  id: string | null;
  /** Created or restored under a lease and not opened yet: Welcome's candidate on a later load. */
  staged: string | null;
  /** The record Sign out let go of: unlisted, kept until a replacement opens; a login with the same master takes it back. */
  released: string | null;
  lease: { tab: string; at: number } | null;
}

export interface SlotView {
  record: MasterRecord | null;
  staged: MasterRecord | null;
  revision: number;
}

/** A reservation, from before the prompt to the commit; `revision` follows the writes made under it. */
export interface Reservation {
  tab: string;
  intent: Intent;
  revision: number;
  /** `open`: the record to open (the slot's, or the staged one). */
  record?: MasterRecord;
  /** Every record on the device, listed or not: `excludeCredentials` for a create, the matches for a login. */
  known: MasterRecord[];
}

export class SlotError extends Error {
  override readonly name = 'SlotError';
  constructor(
    readonly kind: 'held' | 'empty' | 'busy' | 'changed',
    message: string,
  ) {
    super(message);
  }
}

const EMPTY: SlotState = { v: 1, revision: 0, id: null, staged: null, released: null, lease: null };

/** The newest-created record outside `except`: the legacy rule for a device that had records before the slot. */
const newest = (records: MasterRecord[], except: (string | null)[]): MasterRecord | undefined =>
  records.filter((r) => !except.includes(r.id)).sort((a, b) => b.createdAt - a.createdAt)[0];

/**
 * The state as it stands against the records: an id the records no longer carry is dropped, and an
 * empty slot takes the newest-created record that is neither staged nor released. Pure; the next
 * write persists what it computed.
 */
function resolve(raw: SlotState | undefined, records: MasterRecord[]): SlotState {
  const has = (id: string | null) => id !== null && records.some((r) => r.id === id);
  const s = { ...(raw ?? EMPTY) };
  if (!has(s.id)) s.id = null;
  if (!has(s.staged)) s.staged = null;
  if (!has(s.released)) s.released = null;
  if (s.id === null) s.id = newest(records, [s.staged, s.released])?.id ?? null;
  return s;
}

const byId = (records: MasterRecord[], id: string | null) => records.find((r) => r.id === id) ?? null;

/** Reads both stores inside `tx`: the resolved state and every record. */
async function load(tx: IDBTransaction): Promise<{ state: SlotState; records: MasterRecord[] }> {
  const records = await request(tx.objectStore(RECORDS).getAll() as IDBRequest<MasterRecord[]>);
  const raw = await request(tx.objectStore(DEVICE).get(SLOT_KEY) as IDBRequest<SlotState | undefined>);
  return { state: resolve(raw, records), records };
}

const save = (tx: IDBTransaction, state: SlotState): Promise<unknown> =>
  request(tx.objectStore(DEVICE).put({ ...state, revision: state.revision + 1 }, SLOT_KEY));

const changed = () => new SlotError('changed', 'The account changed in another tab. Retry.');

export function readSlot(): Promise<SlotView> {
  return transaction([RECORDS, DEVICE], 'readonly', async (tx) => {
    const { state, records } = await load(tx);
    return { record: byId(records, state.id), staged: byId(records, state.staged), revision: state.revision };
  });
}

/**
 * Before any prompt. `create` and `login` refuse a slot that holds or stages a record and take the
 * lease (a second tab's create is refused for LEASE_MS); `open` only checks the record is still the
 * one the dialog showed. Refused when `expectedRevision` is behind: the caller re-reads.
 */
export function reserve(expectedRevision: number, intent: Intent, tab = TAB): Promise<Reservation> {
  return transaction([RECORDS, DEVICE], 'readwrite', async (tx) => {
    const { state, records } = await load(tx);
    if (state.revision !== expectedRevision) throw changed();
    const now = Date.now();
    if (intent === 'open') {
      const record = byId(records, state.id) ?? byId(records, state.staged);
      if (!record) throw new SlotError('empty', 'No account is stored in this browser.');
      return { tab, intent, revision: state.revision, record, known: records };
    }
    const holder = byId(records, state.id) ?? byId(records, state.staged);
    if (holder)
      throw new SlotError(
        'held',
        `This browser holds ${shortAddress(holder.account.address)}. Sign that account out first to switch; it asks about backup before it goes.`,
      );
    if (state.lease && state.lease.tab !== tab && now - state.lease.at < LEASE_MS)
      throw new SlotError('busy', 'Another tab is opening an account. Close that tab, then retry here.');
    await save(tx, { ...state, lease: { tab, at: now } });
    return { tab, intent, revision: state.revision + 1, known: records };
  });
}

const ours = (state: SlotState, r: Reservation) => state.lease?.tab === r.tab;

/** The created or restored record, durable before the wallet boots; under the lease `r` still holds. */
export function stage(r: Reservation, record: MasterRecord): Promise<void> {
  return transaction([RECORDS, DEVICE], 'readwrite', async (tx) => {
    const { state } = await load(tx);
    if (state.revision !== r.revision || !ours(state, r)) throw changed();
    await request(tx.objectStore(RECORDS).put(record));
    await save(tx, { ...state, staged: record.id });
    r.revision = state.revision + 1;
  });
}

/**
 * After a verified opening: the staged record (or the one `open` targeted) is the slot, the lease
 * ends, and a record released earlier is deleted now unless it is the one committed (a login with
 * the same master took it back).
 */
export function commit(r: Reservation): Promise<void> {
  return transaction([RECORDS, DEVICE], 'readwrite', async (tx) => {
    const { state, records } = await load(tx);
    const id = r.intent === 'open' ? (r.record?.id ?? null) : ours(state, r) ? state.staged : null;
    if (id === null || !byId(records, id) || (state.id !== null && state.id !== id)) throw changed();
    if (state.released !== null && state.released !== id)
      await request(tx.objectStore(RECORDS).delete(state.released));
    await save(tx, {
      ...state,
      id,
      staged: null,
      released: null,
      lease: ours(state, r) ? null : state.lease,
    });
    r.revision = state.revision + 1;
  });
}

/** A cancelled or failed opening: the lease ends, a staged record stays for the next load. */
export function cancel(r: Reservation): Promise<void> {
  return transaction([RECORDS, DEVICE], 'readwrite', async (tx) => {
    const { state } = await load(tx);
    if (!ours(state, r)) return;
    await save(tx, { ...state, lease: null });
    r.revision = state.revision + 1;
  });
}

/**
 * Sign out. The slot's record is kept unlisted until a replacement opens (one released before it
 * is deleted now); a legacy second record, if any, takes the slot. A staged record never held the
 * slot, so it is deleted: its passkey or words restore it.
 */
export function release(id: string, expectedRevision: number): Promise<void> {
  return transaction([RECORDS, DEVICE], 'readwrite', async (tx) => {
    const { state, records } = await load(tx);
    if (state.revision !== expectedRevision) throw changed();
    const next = { ...state };
    if (state.id === id) {
      if (state.released !== null && state.released !== id)
        await request(tx.objectStore(RECORDS).delete(state.released));
      next.released = id;
      next.id = newest(records, [id, state.staged])?.id ?? null;
    } else if (state.staged === id) {
      await request(tx.objectStore(RECORDS).delete(id));
      next.staged = null;
    } else throw changed();
    await save(tx, next);
  });
}
