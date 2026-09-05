// The key flows the screen drives: create a passkey key, open a known one, restore one from a
// discoverable passkey. Each resolves to a running miner or leaves the key screen with a message.
import type { createStore } from 'jotai';
import { masterFromPrf } from '../../miner-core/src/keys/derive.ts';
import { type Preflighted, preflight, startSession } from './boot';
import type { Connection } from './config';
import type { MinerController } from './controller';
import { keysAllowed } from './host';
import { assertPasskey, createPasskey } from './keys/passkey';
import {
  addressOf,
  base64url,
  fromBase64url,
  listRecords,
  type MasterRecord,
  openMaster,
  putRecord,
  sealMaster,
  setStayOpen,
} from './keys/store';
import { loadSettings, saveSettings } from './settings';
import { bootAtom } from './state';

type Store = ReturnType<typeof createStore>;

export class Session {
  private pre: Preflighted | undefined;
  controller: MinerController | undefined;
  /** The open key's master, in memory for the tab's life (convenience mode switches need it). */
  private master: Uint8Array | undefined;
  record: MasterRecord | undefined;

  readonly ready: Promise<void>;

  constructor(
    private readonly store: Store,
    private readonly connection: Connection,
  ) {
    this.ready = preflight(store, connection).then(
      (pre) => {
        this.pre = pre;
      },
      (e: unknown) =>
        store.set(bootAtom, { phase: 'error', message: e instanceof Error ? e.message : String(e) }),
    );
  }

  private get rpId(): string {
    return import.meta.env.VITE_RP_ID;
  }

  private guardHost(): void {
    if (!keysAllowed(location.hostname))
      throw new Error(`keys can only be created or restored on ${this.rpId}`);
  }

  private async fail(e: unknown): Promise<void> {
    this.store.set(bootAtom, {
      phase: 'key',
      records: await listRecords(),
      error: e instanceof Error ? e.message : String(e),
    });
  }

  private async start(record: MasterRecord, master: Uint8Array): Promise<void> {
    if (!this.pre) throw new Error('preflight has not finished');
    this.master = master;
    this.record = record;
    this.controller = await startSession(this.store, this.pre, this.connection, record, master);
  }

  /** The ceremony is the first await after the click; the vault write follows a successful start. */
  async createWithPasskey(): Promise<void> {
    try {
      this.guardHost();
      const known = (await listRecords()).flatMap((r) =>
        r.credentialId ? [fromBase64url(r.credentialId)] : [],
      );
      const { credentialId, prf } = await createPasskey({
        rpId: this.rpId,
        userName: 'Yacana key',
        exclude: known,
      });
      const master = await masterFromPrf(prf);
      const record: MasterRecord = {
        v: 1,
        id: crypto.randomUUID(),
        method: 'passkey',
        createdAt: Date.now(),
        credentialId: base64url(credentialId),
        askEveryOpen: !loadSettings().stayOpen,
        backedUp: false,
        account: { address: await addressOf(master, 0), index: 0 },
      };
      if (!record.askEveryOpen) record.sealed = await sealMaster(master, record);
      await putRecord(record);
      await this.start(record, master);
    } catch (e) {
      await this.fail(e);
    }
  }

  /** One touch on a known record (default mode), or none when the master is sealed on this device. */
  async open(record: MasterRecord): Promise<void> {
    try {
      const master = record.sealed
        ? await openMaster(record)
        : await openMaster(record, await this.masterFromCeremony(record));
      await this.start(record, master);
    } catch (e) {
      await this.fail(e);
    }
  }

  private async masterFromCeremony(record: MasterRecord): Promise<Uint8Array> {
    if (record.method !== 'passkey' || !record.credentialId)
      throw new Error('this key needs its twelve words to open');
    const { prf } = await assertPasskey({ rpId: this.rpId, allow: [fromBase64url(record.credentialId)] });
    return masterFromPrf(prf);
  }

  /** "I already have a key": a discoverable request; a known address opens, a new one gets a record. */
  async restoreWithPasskey(): Promise<void> {
    try {
      this.guardHost();
      const { credentialId, prf } = await assertPasskey({ rpId: this.rpId });
      const master = await masterFromPrf(prf);
      const address = await addressOf(master, 0);
      const existing = (await listRecords()).find((r) => r.account.address === address);
      const record: MasterRecord = existing ?? {
        v: 1,
        id: crypto.randomUUID(),
        method: 'passkey',
        createdAt: Date.now(),
        credentialId: base64url(credentialId),
        askEveryOpen: true,
        backedUp: false,
        account: { address, index: 0 },
      };
      if (!existing) await putRecord(record);
      await this.start(record, await openMaster(record, master));
    } catch (e) {
      await this.fail(e);
    }
  }

  /** Settings → "stay open on this device": seals the master now or drops the ciphertext. */
  async setStayOpen(stayOpen: boolean): Promise<void> {
    if (!this.record || !this.master) return;
    this.record = await setStayOpen(this.record, this.master, stayOpen);
    saveSettings({ ...loadSettings(), stayOpen });
    const boot = this.store.get(bootAtom);
    if (boot.phase === 'ready') this.store.set(bootAtom, { ...boot, record: this.record });
  }
}
