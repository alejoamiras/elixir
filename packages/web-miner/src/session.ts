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
import { expectedOf, type Preflighted, preflight, type Started, startSession, switchNodeLive } from './boot';
import {
  loadArtifact,
  readPublicBalance,
  recipientKnown,
  type Sent,
  sendWithdraw,
  type Withdrawal,
} from './chain';
import { type Connection, saveConnection } from './config';
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
import { initialSteps } from './opening-steps';
import { loadSettings, saveSettings } from './settings';
import { bootAtom, epochAtom } from './state';

type Store = ReturnType<typeof createStore>;

const isAbort = (e: unknown): boolean => e instanceof DOMException && e.name === 'AbortError';

/** Runs the work a freshly derived master feeds; if that work throws, the master is zeroed first. */
async function owning<T>(master: Uint8Array, work: () => Promise<T>): Promise<T> {
  try {
    return await work();
  } catch (e) {
    master.fill(0);
    throw e;
  }
}

export class Session {
  private pre: Preflighted | undefined;
  controller: MinerController | undefined;
  /** One node switch at a time: a tile remount must not start a second against the same account. */
  private switching: Promise<void> | undefined;
  private switchingUrl: string | undefined;
  /** A switch that failed left no working wallet: further node choices reboot rather than live-switch. */
  private dead = false;
  private wallet: (() => EmbeddedWallet) | undefined;
  /** The open key's master, in memory for the tab's life (convenience mode switches need it). */
  private master: Uint8Array | undefined;
  /** A words key's phrase, for the backup screen; sealed at rest, never in the store as text. */
  private words: string | undefined;
  record: MasterRecord | undefined;

  /** The open attempt: its generation and the AbortController Cancel aborts once the ceremony is over. */
  private attempt: { id: number; abort: AbortController; ceremony: boolean; done: Promise<void> } | undefined;
  private attemptSeq = 0;

  readonly ready: Promise<void>;

  private readonly startImpl: typeof startSession;
  private readonly preflightImpl: typeof preflight;

  constructor(
    private readonly store: Store,
    private readonly connection: Connection,
    // Injectable for tests: the real ones open the wallet / run the preflight against a node.
    deps: { startImpl?: typeof startSession; preflightImpl?: typeof preflight } = {},
  ) {
    this.startImpl = deps.startImpl ?? startSession;
    this.preflightImpl = deps.preflightImpl ?? preflight;
    this.ready = this.runPreflight();
  }

  /** A preflight the node failed (throttled or silent) is shown, then tried again once the node is usable. */
  private async runPreflight(): Promise<void> {
    try {
      this.pre = await this.preflightImpl(this.store, this.connection);
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

  /** Back to the signed-out cockpit with the error; `id` names the attempt speaking, if any. */
  private async fail(e: unknown, id?: number): Promise<void> {
    const records = await listRecords();
    if (id !== undefined && this.attempt?.id !== id) return; // a replacement began meanwhile
    this.store.set(bootAtom, {
      phase: 'signedOut',
      records,
      error: e instanceof Error ? e.message : String(e),
    });
    // No account came up: the public epoch feeds the cockpit again.
    this.pre?.publicEpoch.start();
  }

  /**
   * A cancellable opening. A previous attempt is aborted and its cleanup awaited first (one PXE at a
   * time; a queued attempt superseded meanwhile never prompts). The ceremony (an OS passkey prompt,
   * or the words work) runs under the new attempt with Cancel inert; then `startImpl` runs the steps,
   * honouring the signal between them. Whatever an attempt made and the session did not adopt — a
   * controller, a wallet, the master — is disposed, stopped or zeroed before it ends; a cancel returns
   * to `signedOut` with no error and the public poll takes the epoch back; a superseded attempt
   * publishes nothing, even from a publish already in flight.
   */
  private runAttempt(
    keyLabel: string,
    ceremony: () => Promise<{ record: MasterRecord; master: Uint8Array; words?: string }>,
  ): Promise<void> {
    if (!this.pre) return this.fail(new Error('preflight has not finished'));
    const prev = this.attempt;
    const id = ++this.attemptSeq;
    const abort = new AbortController();
    const steps = initialSteps(keyLabel);
    const key = steps.find((step) => step.id === 'key');
    if (key) key.state = 'active'; // the ceremony is the active step; `done` means Cancel works
    this.store.set(bootAtom, { phase: 'opening', steps });
    const attempt = { id, abort, ceremony: true, done: Promise.resolve() };
    this.attempt = attempt;
    const run = this.attemptBody(id, abort, keyLabel, ceremony, prev).finally(() => {
      if (this.attempt?.id === id) this.attempt = undefined;
    });
    attempt.done = run;
    return run;
  }

  private async attemptBody(
    id: number,
    abort: AbortController,
    keyLabel: string,
    ceremony: () => Promise<{ record: MasterRecord; master: Uint8Array; words?: string }>,
    prev: Session['attempt'],
  ): Promise<void> {
    const mine = () => this.attempt?.id === id;
    let master: Uint8Array | undefined;
    let started: Started | undefined;
    // Whatever the steps returned that the session did not adopt: disposed, and its wallet stopped —
    // awaited, so `done` (and a successor, and the signed-out publish) come after the namespace is free.
    const discard = async () => {
      if (!started || started.controller === this.controller) return;
      const s = started;
      started = undefined;
      s.controller.dispose();
      await s
        .wallet()
        .stop()
        .catch(() => {});
    };
    try {
      // The predecessor ends first (it sees itself superseded and publishes nothing) so two attempts
      // never hold the PXE namespace at once; a queued attempt superseded meanwhile never prompts.
      if (prev) {
        prev.abort.abort();
        await prev.done.catch(() => {});
      }
      if (!mine()) return;
      abort.signal.throwIfAborted();
      const t0 = performance.now();
      const c = await ceremony();
      master = c.master;
      const keyMs = performance.now() - t0;
      if (!mine()) return;
      (this.attempt as { ceremony: boolean }).ceremony = false; // the prompt is done: Cancel works
      abort.signal.throwIfAborted();
      started = await this.startImpl(this.store, this.pre as Preflighted, this.connection, c.record, master, {
        signal: abort.signal,
        keyLabel,
        keyMs,
        nodeMs: (this.pre as Preflighted).nodeMs,
        publish: (steps) => mine() && this.store.set(bootAtom, { phase: 'opening', steps }),
      });
      if (!mine()) return;
      abort.signal.throwIfAborted(); // a cancel that landed as the last step settled
      this.controller = started.controller;
      this.wallet = started.wallet;
      this.master = master;
      this.record = c.record;
      this.words = c.words;
      master = undefined; // the session owns it now
      this.store.set(bootAtom, {
        phase: 'ready',
        account: c.record.account.address,
        threads: started.threads,
        record: c.record,
      });
    } catch (e) {
      await discard();
      if (!mine()) return; // a stale attempt publishes nothing
      // A cancel wins over whatever the abort made the steps throw (a download that failed later).
      if (isAbort(e) || abort.signal.aborted) await this.toSignedOut(id);
      else await this.fail(e, id);
    } finally {
      master?.fill(0);
      await discard();
    }
  }

  /** Aborts the open in flight, once its ceremony is over, and waits for its cleanup to finish. */
  async cancelOpening(): Promise<void> {
    const a = this.attempt;
    if (!a || a.ceremony) return;
    a.abort.abort();
    await a.done.catch(() => {});
  }

  /** Back to the signed-out cockpit with no error (a cancel); the public poll feeds the chain again. */
  private async toSignedOut(id: number): Promise<void> {
    const records = await listRecords();
    if (this.attempt?.id !== id) return; // a replacement began meanwhile: its opening stands
    this.store.set(bootAtom, { phase: 'signedOut', records });
    this.pre?.publicEpoch.start();
  }

  /** The record is written before the wallet opens: a boot failure must not lose a fresh passkey. */
  async createWithPasskey(): Promise<void> {
    return this.runAttempt('passkey', async () => {
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
      return owning(master, async () => {
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
        return { record, master };
      });
    });
  }

  /** One touch on a known record (default mode), or none when the secret is sealed on this device. */
  async open(record: MasterRecord): Promise<void> {
    const keyLabel = record.method === 'passkey' ? 'passkey' : 'twelve words';
    return this.runAttempt(keyLabel, async () => {
      const master = record.sealed
        ? await openMaster(record)
        : await this.masterFromCeremony(record).then((m) => owning(m, () => openMaster(record, m)));
      return owning(master, async () => ({
        record,
        master,
        words: record.method === 'words' ? await openPhrase(record) : undefined,
      }));
    });
  }

  private async masterFromCeremony(record: MasterRecord): Promise<Uint8Array> {
    if (record.method !== 'passkey' || !record.credentialId)
      throw new Error('this account needs its twelve words to open');
    const { prf } = await assertPasskey({ rpId: this.rpId, allow: [fromBase64url(record.credentialId)] });
    return masterFromPrf(prf);
  }

  /** "I already have a key": a discoverable request; a known address opens, a new one gets a record. */
  async restoreWithPasskey(): Promise<void> {
    return this.runAttempt('passkey', async () => {
      this.guardHost();
      const { credentialId, prf } = await assertPasskey({ rpId: this.rpId });
      const master = await masterFromPrf(prf);
      return owning(master, async () => {
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
        return { record, master: await openMaster(record, master) };
      });
    });
  }

  /** A fresh phrase; the key exists only once the screen calls `createWithWords` with it. */
  newWords(): string {
    this.guardHost();
    return generateWords();
  }

  /** Words keys seal their entropy: nothing re-derives it, and a skipped backup can be shown later. */
  async createWithWords(phrase: string, backedUp: boolean): Promise<void> {
    return this.runAttempt('twelve words', () => this.wordsRecord(phrase, backedUp));
  }

  /** A fresh sealed words record and its master (derived here unless the caller already has it). */
  private async wordsRecord(
    phrase: string,
    backedUp: boolean,
    derived?: Uint8Array,
  ): Promise<{ record: MasterRecord; master: Uint8Array; words: string }> {
    this.guardHost();
    const master = derived ?? (await masterFromMnemonic(phrase));
    return owning(master, async () => {
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
      return { record, master, words: normaliseWords(phrase) };
    });
  }

  /** Restore: the phrase opens its record if this device has one, or gets a new (sealed) record. */
  async restoreWithWords(phrase: string): Promise<void> {
    return this.runAttempt('twelve words', async () => {
      this.guardHost();
      const master = await masterFromMnemonic(phrase);
      return owning(master, async () => {
        const address = await addressOf(master, 0);
        const existing = (await listRecords()).find((r) => r.account.address === address);
        if (existing)
          return {
            record: existing,
            master: await openMaster(existing, master),
            words: normaliseWords(phrase),
          };
        return this.wordsRecord(normaliseWords(phrase), true, master);
      });
    });
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
    // A terminal failure abandoned the wallet, and no preflight means nothing to move under: either
    // way the saved setting takes effect on a fresh boot. Reload only once the write lands.
    if (this.dead || !this.pre) {
      if (!saveConnection({ nodeUrl: url }))
        throw new Error('The browser refused to save the setting; free some site storage and try again.');
      return location.reload();
    }
    // Until the attempt adopts its controller there is nothing to drain: a swap under it would leave
    // the opening wallet on a node the guard no longer admits.
    if (this.attempt)
      throw new Error('an account is opening; cancel it or let it finish before changing the node');
    if (this.switching) {
      if (this.switchingUrl === url) return this.switching; // the same switch, already underway
      throw new Error('a node switch is already underway; wait for it to finish');
    }
    const pre = this.pre;
    const publicOnly = !this.controller;
    this.switchingUrl = url;
    this.switching = (async () => {
      // Signed out, the public poll is the only reader: drained before the swap (a read out on the old
      // node is waited for and lands nowhere), the epoch it guarded against regressing cleared; it
      // restarts on the new node once the swap settled.
      if (publicOnly) {
        await pre.publicEpoch.stop();
        this.store.set(epochAtom, null);
      }
      await switchNodeLive({ controller: this.controller, switchable: pre.switchable, url });
    })()
      .catch((e: unknown) => {
        // A rebuild that failed left no working wallet: the boot error carries the way out, and the
        // next node choice reboots rather than live-switching a dead account.
        this.dead = true;
        const message = e instanceof Error ? e.message : String(e);
        this.store.set(bootAtom, {
          phase: 'error',
          message: `the node changed but its chain view could not be rebuilt (${message}); use another node or reload`,
        });
        throw e;
      })
      .finally(() => {
        if (publicOnly) pre.publicEpoch.start();
        this.switching = undefined;
        this.switchingUrl = undefined;
      });
    return this.switching;
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
      return await c.track(async () => {
        const sent = await sendWithdraw(c.deployment, c.address, c.feeSettings, w);
        await c.refresh().catch((e: unknown) => c.log(`balance after withdraw: ${String(e)}`));
        return sent;
      });
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
