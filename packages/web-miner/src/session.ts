// The key flows the screens drive: create a passkey or words key, open a known one, restore one,
// back it up, forget it; the wallet's withdraw. Each resolves to a running miner or leaves the
// screen with a message.
import { AztecAddress } from '@aztec/aztec.js/addresses';
import type { EmbeddedWallet } from '@aztec/wallets/embedded';
import type { createStore } from 'jotai';
import { masterFromPrf } from '../../miner-core/src/keys/derive.ts';
import {
  entropyOf,
  generateWords,
  masterFromMnemonic,
  normaliseWords,
} from '../../miner-core/src/keys/mnemonic.ts';
import { keysAllowed } from '../../site/src/browser/host.ts';
import { type NodeProbe, probeNode } from '../../site/src/browser/node.ts';
import { nodeHealth, waitTurn } from '../../site/src/browser/node-health.ts';
import { expectedOf, type Preflighted, preflight, startSession, switchNodeLive } from './boot';
import {
  loadArtifact,
  readPublicBalance,
  recipientKnown,
  type Sent,
  sendWithdraw,
  type Withdrawal,
} from './chain';
import type { Connection } from './config';
import type { MinerController } from './controller';
import { assertPasskey, createPasskey } from './keys/passkey';
import {
  addressOf,
  base64url,
  forgetMaster,
  fromBase64url,
  listRecords,
  type MasterRecord,
  openMaster,
  openPhrase,
  putRecord,
  seal,
  setStayOpen,
} from './keys/store';
import { loadSettings, saveSettings } from './settings';
import { bootAtom } from './state';

type Store = ReturnType<typeof createStore>;

export class Session {
  private pre: Preflighted | undefined;
  controller: MinerController | undefined;
  private wallet: (() => EmbeddedWallet) | undefined;
  /** The open key's master, in memory for the tab's life (convenience mode switches need it). */
  private master: Uint8Array | undefined;
  /** A words key's phrase, for the backup screen; sealed at rest, never in the store as text. */
  private words: string | undefined;
  record: MasterRecord | undefined;

  readonly ready: Promise<void>;

  constructor(
    private readonly store: Store,
    private readonly connection: Connection,
  ) {
    this.ready = this.runPreflight();
  }

  /** A preflight the node failed (throttled or silent) is shown, then tried again once the node is usable. */
  private async runPreflight(): Promise<void> {
    try {
      this.pre = await preflight(this.store, this.connection);
    } catch (e) {
      this.store.set(bootAtom, { phase: 'error', message: e instanceof Error ? e.message : String(e) });
      if (nodeHealth().transport.kind === 'ok') return;
      await waitTurn();
      return this.runPreflight();
    }
  }

  private get rpId(): string {
    return import.meta.env.VITE_RP_ID;
  }

  private guardHost(): void {
    if (!keysAllowed(location.hostname))
      throw new Error(`accounts can only be created or restored on ${this.rpId}`);
  }

  private async fail(e: unknown): Promise<void> {
    this.store.set(bootAtom, {
      phase: 'key',
      records: await listRecords(),
      error: e instanceof Error ? e.message : String(e),
    });
  }

  private async start(record: MasterRecord, master: Uint8Array, words?: string): Promise<void> {
    if (!this.pre) throw new Error('preflight has not finished');
    this.master = master;
    this.record = record;
    this.words = words;
    const started = await startSession(this.store, this.pre, this.connection, record, master);
    this.controller = started.controller;
    this.wallet = started.wallet;
  }

  /** The record is written before the wallet opens: a boot failure must not lose a fresh passkey. */
  async createWithPasskey(): Promise<void> {
    try {
      this.guardHost();
      const known = (await listRecords()).flatMap((r) =>
        r.credentialId ? [fromBase64url(r.credentialId)] : [],
      );
      const { credentialId, prf } = await createPasskey({
        rpId: this.rpId,
        userName: 'Yacana account',
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
      if (!record.askEveryOpen) record.sealed = await seal(master, record);
      await putRecord(record);
      await this.start(record, master);
    } catch (e) {
      await this.fail(e);
    }
  }

  /** One touch on a known record (default mode), or none when the secret is sealed on this device. */
  async open(record: MasterRecord): Promise<void> {
    try {
      const master = record.sealed
        ? await openMaster(record)
        : await openMaster(record, await this.masterFromCeremony(record));
      const words = record.method === 'words' ? await openPhrase(record) : undefined;
      await this.start(record, master, words);
    } catch (e) {
      await this.fail(e);
    }
  }

  private async masterFromCeremony(record: MasterRecord): Promise<Uint8Array> {
    if (record.method !== 'passkey' || !record.credentialId)
      throw new Error('this account needs its twelve words to open');
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

  /** A fresh phrase; the key exists only once the screen calls `createWithWords` with it. */
  newWords(): string {
    this.guardHost();
    return generateWords();
  }

  /** Words keys seal their entropy: nothing re-derives it, and a skipped backup can be shown later. */
  async createWithWords(phrase: string, backedUp: boolean): Promise<void> {
    try {
      this.guardHost();
      const master = await masterFromMnemonic(phrase);
      const record: MasterRecord = {
        v: 1,
        id: crypto.randomUUID(),
        method: 'words',
        createdAt: Date.now(),
        askEveryOpen: false,
        backedUp,
        account: { address: await addressOf(master, 0), index: 0 },
      };
      record.sealed = await seal(entropyOf(phrase), record);
      await putRecord(record);
      await this.start(record, master, normaliseWords(phrase));
    } catch (e) {
      await this.fail(e);
    }
  }

  /** Restore: the phrase opens its record if this device has one, or gets a new (sealed) record. */
  async restoreWithWords(phrase: string): Promise<void> {
    try {
      this.guardHost();
      const master = await masterFromMnemonic(phrase);
      const address = await addressOf(master, 0);
      const existing = (await listRecords()).find((r) => r.account.address === address);
      if (existing)
        return await this.start(existing, await openMaster(existing, master), normaliseWords(phrase));
      await this.createWithWords(normaliseWords(phrase), true);
    } catch (e) {
      await this.fail(e);
    }
  }

  /** The open words key's phrase, for the backup screen; never stored, only re-shown from memory. */
  get openWords(): string | undefined {
    return this.record?.method === 'words' ? this.words : undefined;
  }

  async markBackedUp(): Promise<void> {
    if (!this.record) return;
    this.record = { ...this.record, backedUp: true };
    await putRecord(this.record);
    const boot = this.store.get(bootAtom);
    if (boot.phase === 'ready') this.store.set(bootAtom, { ...boot, record: this.record });
  }

  /** Removes a record; the sign-out dialog gates the call. An open account's session ends. */
  async forget(record: MasterRecord): Promise<void> {
    await forgetMaster(record.id);
    if (this.record?.id === record.id) location.reload();
  }

  /** The node in use; the switch target's identity was checked by the caller (the Node tile's probe). */
  get nodeUrl(): string | undefined {
    return this.pre?.switchable.current();
  }

  /**
   * The deployment check plus the tip and latency of `url`; on the node in use it rides the page's
   * handle. Works before or without a successful preflight (a dead saved node is when it matters most).
   */
  async probeNode(url: string, deadlineMs = 10_000): Promise<NodeProbe> {
    const pre = this.pre;
    const layout =
      pre?.minerArtifact.storageLayout ?? (await loadArtifact('yacana_miner-YacanaMiner')).storageLayout;
    const inUse = pre !== undefined && url === pre.switchable.current();
    return probeNode(
      url,
      pre?.expected ?? expectedOf(this.connection),
      layout,
      deadlineMs,
      inUse ? () => pre.node : undefined,
    );
  }

  /**
   * Points every holder at another node without a reload: mining pauses, whatever is in flight
   * finishes, the handle moves, an open account's chain view is rebuilt from the new node, mining
   * resumes. The caller checked the candidate against this deployment first.
   */
  async switchNode(url: string): Promise<void> {
    // Without a preflight there is nothing to move under: the saved setting takes effect on reload.
    if (!this.pre) return location.reload();
    await switchNodeLive({ controller: this.controller, switchable: this.pre.switchable, url });
  }

  /** Someone expects to send us notes: the PXE needs the sender to find them. */
  async addSender(address: string): Promise<void> {
    if (!this.wallet) throw new Error('no open account');
    await this.wallet().registerSender(AztecAddress.fromStringUnsafe(address), '');
  }

  /** Whether anything on the chain or in the wallet knows the recipient as a contract. */
  async recipientKnown(to: AztecAddress): Promise<boolean> {
    if (!this.pre || !this.wallet) throw new Error('no open account');
    return recipientKnown(this.wallet(), this.pre.node, to);
  }

  /**
   * Mining pauses around the send so the prover and the transfer proof never fight for memory.
   * A balance read failing after the transfer is in a block cannot fail the call, or the same
   * transfer would be sent again.
   */
  async withdraw(w: Withdrawal): Promise<Sent> {
    const c = this.controller;
    if (!c) throw new Error('no open account');
    c.pause('withdraw');
    try {
      const sent = await sendWithdraw(c.deployment, c.address, c.feeSettings, w);
      await c.refresh().catch((e: unknown) => c.log(`balance after withdraw: ${String(e)}`));
      return sent;
    } finally {
      c.release('withdraw');
    }
  }

  publicBalance(owner: string): Promise<bigint> {
    const c = this.controller;
    if (!c) throw new Error('no open account');
    return readPublicBalance(c.deployment, c.address, AztecAddress.fromStringUnsafe(owner));
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
