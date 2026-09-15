import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, test } from 'bun:test';
import { cancel, commit, LEASE_MS, readSlot, release, reserve, stage } from '../src/keys/slot.ts';
import { DB_NAME, forgetMaster, listRecords, type MasterRecord, putRecord } from '../src/keys/store.ts';

const reset = () =>
  new Promise<void>((resolve) => {
    const r = indexedDB.deleteDatabase(DB_NAME);
    r.onsuccess = () => resolve();
    r.onerror = () => resolve();
  });

const record = (id: string, createdAt: number, patch: Partial<MasterRecord> = {}): MasterRecord => ({
  v: 1,
  id,
  method: 'passkey',
  createdAt,
  credentialId: id,
  askEveryOpen: true,
  backedUp: false,
  account: { address: `0x${id.padEnd(64, '0')}`, index: 0 },
  ...patch,
});

const ids = async () => (await listRecords()).map((r) => r.id).sort();

describe('the slot', () => {
  beforeEach(reset);

  test('a device with two records from before the slot: the newest-created holds it, the other is unlisted and takes it on release', async () => {
    await putRecord(record('old', 1));
    await putRecord(record('new', 2));
    const view = await readSlot();
    expect(view.record?.id).toBe('new');
    expect(view.staged).toBeNull();
    await expect(reserve(view.revision, 'create')).rejects.toMatchObject({ kind: 'held' });
    await release('new', view.revision);
    const after = await readSlot();
    expect(after.record?.id).toBe('old');
    expect(await ids()).toEqual(['new', 'old']); // released, not deleted
  });

  test('create: refused over a held slot before any prompt; the record lands staged, the commit makes it the slot', async () => {
    const empty = await readSlot();
    expect(empty.record).toBeNull();
    const r = await reserve(empty.revision, 'create');
    expect(r.known).toEqual([]);
    await stage(r, record('a', 1));
    // A crash here: the next load offers the staged record and holds nothing.
    const staged = await readSlot();
    expect(staged.record).toBeNull();
    expect(staged.staged?.id).toBe('a');
    await commit(r);
    const held = await readSlot();
    expect(held.record?.id).toBe('a');
    expect(held.staged).toBeNull();
    await expect(reserve(held.revision, 'login')).rejects.toThrow(/This browser holds 0xa00000…0000/);
    // A stale view (the revision the dialog saw) is refused, never applied.
    await expect(reserve(empty.revision, 'open')).rejects.toMatchObject({ kind: 'changed' });
    const open = await reserve(held.revision, 'open');
    expect(open.record?.id).toBe('a');
    await commit(open);
    expect((await readSlot()).record?.id).toBe('a');
  });

  test('two tabs: the second create is refused while the lease lives, reclaims it after, and the first tab’s stage is then refused', async () => {
    const { revision } = await readSlot();
    const first = await reserve(revision, 'create', 'tab-1');
    await expect(reserve(first.revision, 'create', 'tab-2')).rejects.toMatchObject({ kind: 'busy' });
    // The first tab went quiet: two minutes later the second takes the lease.
    const now = Date.now;
    Date.now = () => now() + LEASE_MS + 1;
    try {
      const second = await reserve(first.revision, 'create', 'tab-2');
      await expect(stage(first, record('ghost', 1))).rejects.toMatchObject({ kind: 'changed' });
      await stage(second, record('b', 2));
      await commit(second);
    } finally {
      Date.now = now;
    }
    expect((await readSlot()).record?.id).toBe('b');
    expect(await ids()).toEqual(['b']);
  });

  test('a cancelled opening keeps the staged record for the next load; opening it commits it', async () => {
    const { revision } = await readSlot();
    const r = await reserve(revision, 'login');
    await stage(r, record('w', 1, { method: 'words' }));
    await cancel(r);
    const view = await readSlot();
    expect(view.staged?.id).toBe('w');
    const open = await reserve(view.revision, 'open');
    expect(open.record?.id).toBe('w');
    await commit(open);
    expect((await readSlot()).record?.id).toBe('w');
  });

  test('sign out keeps the record unlisted: a login with the same master takes it back, a different one replaces it once open', async () => {
    let view = await readSlot();
    const r = await reserve(view.revision, 'create');
    await stage(r, record('a', 1));
    await commit(r);
    view = await readSlot();
    await release('a', view.revision);
    view = await readSlot();
    expect(view.record).toBeNull();
    expect(await ids()).toEqual(['a']);
    // The same master: the login finds its record among `known` and stages it again.
    const back = await reserve(view.revision, 'login');
    expect(back.known.map((k) => k.id)).toEqual(['a']);
    await stage(back, back.known[0] as MasterRecord);
    await commit(back);
    expect((await readSlot()).record?.id).toBe('a');
    expect(await ids()).toEqual(['a']);
    // Another master: the old record goes only when the new one has opened.
    view = await readSlot();
    await release('a', view.revision);
    view = await readSlot();
    const other = await reserve(view.revision, 'create');
    await stage(other, record('c', 3));
    expect(await ids()).toEqual(['a', 'c']);
    await commit(other);
    expect(await ids()).toEqual(['c']);
    expect((await readSlot()).record?.id).toBe('c');
  });

  test('a release of a staged record deletes it; a record the previous build deleted leaves the slot empty', async () => {
    let view = await readSlot();
    const r = await reserve(view.revision, 'create');
    await stage(r, record('s', 1));
    await cancel(r);
    view = await readSlot();
    await release('s', view.revision);
    expect(await ids()).toEqual([]);
    view = await readSlot();
    const again = await reserve(view.revision, 'create');
    await stage(again, record('d', 2));
    await commit(again);
    await forgetMaster('d'); // the build before the slot deleting the record it listed
    view = await readSlot();
    expect(view.record).toBeNull();
    expect(view.staged).toBeNull();
    await expect(reserve(view.revision, 'open')).rejects.toMatchObject({ kind: 'empty' });
    await reserve(view.revision, 'create');
  });
});
