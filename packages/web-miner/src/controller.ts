// Drives the reducer: chain reads on a timer, the Worker for proving, the wallet for claims, the
// chain-view reset after a lost race.
import type { AztecAddress } from '@aztec/aztec.js/addresses';
import { Fr } from '@aztec/aztec.js/fields';
import type { TxEffect } from '@aztec/stdlib/tx';
import type { createStore } from 'jotai';
import {
  claimFailureMessage,
  classifyClaimFailure,
  finalitySeconds,
} from '../../miner-core/src/claim-failure.ts';
import { PARAMS } from '../../miner-core/src/generated/params.ts';
import { difficulty } from '../../miner-core/src/metrics.ts';
import { deployDomain, ticketNullifier } from '../../miner-core/src/proof.ts';
import { newEpochSecret } from '../../miner-core/src/secret.ts';
import { type Deployment, type Fee, readBalance, readEpoch, sendClaim, sendRoll } from './chain';
import { chime } from './chime';
import { amount } from './lib/format';
import { type Command, type Event, reduce } from './lib/reducer';
import { settingsAtom } from './settings';
import { balanceAtom, claimsAtom, epochAtom, logAtom, minerAtom } from './state';
import type { FromWorker, MineJob, ToWorker } from './worker-protocol';

type Store = ReturnType<typeof createStore>;

const EPOCH_POLL_MS = 10_000;
/** A read that takes longer than this counts as failed: the RPC client has no deadline of its own. */
const READ_DEADLINE_MS = 30_000;
/** Failed reads for this long mean the node is gone, not slow. */
const OFFLINE_AFTER_MS = 60_000;
const MAX_CRASHES = 3;
/** The pause when the rollup's constants cannot be read either. */
const FALLBACK_FINALITY_S = 40 * 60;

type PauseReason = 'battery' | 'hidden' | 'withdraw' | 'offline' | 'lost-race';

interface Prover {
  worker: Worker;
  ready: Promise<void>;
  generation: number;
}

export interface Rebound {
  deployment: Deployment;
  fee: Fee;
  /** False when the chain view could not be dropped and the old one was merely reopened. */
  rebuilt: boolean;
}

export interface MinerOptions {
  store: Store;
  spawnWorker: () => Worker;
  threads: number;
  deployment: Deployment;
  account: AztecAddress;
  fee: Fee;
  chainId: bigint;
  rollupVersion: bigint;
  /** Rebuilds the key's chain view (wallet, account, deployment) after a lost race. */
  recover?: () => Promise<Rebound>;
  readDeadlineMs?: number;
}

/** What the E2E checks about the last minted claim: the effect as read, and the expected nullifier. */
export interface LastClaim {
  txHash: string;
  nullifiers: string[];
  noteHashes: string[];
  ticketNullifier: string;
}

const short = (hex: string) => `${hex.slice(0, 8)}…${hex.slice(-4)}`;

const deadline = <T>(p: Promise<T>, ms: number): Promise<T> =>
  new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`no answer from the node in ${ms / 1000} s`)), ms);
    p.then(resolve, reject).finally(() => clearTimeout(t));
  });

/**
 * The effect holds the tx-hash nullifier, the ticket's, the token's delivery nullifier and, on a
 * first contact, the registry's handshake nullifier and note; the ticket is matched by value, the
 * minted note is the first note hash.
 */
async function claimMarks(
  effect: TxEffect,
  digest: string,
  miner: AztecAddress,
): Promise<LastClaim & { nullifier: string; noteHash: string; noteHashes: string[] }> {
  const ticket = (await ticketNullifier(Fr.fromString(digest), miner)).toString();
  const nullifiers = effect.nullifiers.map((n) => n.toString());
  const noteHashes = effect.noteHashes.map((n) => n.toString());
  return {
    txHash: effect.txHash.toString(),
    nullifiers,
    noteHashes,
    ticketNullifier: ticket,
    nullifier: nullifiers.find((n) => n === ticket) ?? nullifiers[1] ?? '0x0',
    noteHash: noteHashes[0] ?? '0x0',
  };
}

export class MinerController {
  private readonly store: Store;
  private readonly spawnWorker: () => Worker;
  private threads: number;
  private d: Deployment;
  private readonly account: AztecAddress;
  private fee: Fee;
  private readonly chainId: bigint;
  private readonly rollupVersion: bigint;
  private readonly recover: (() => Promise<Rebound>) | undefined;
  private readonly readDeadlineMs: number;

  private secrets = new Map<number, string>();
  private nextNonce = new Map<string, bigint>();
  private pending: {
    epoch: bigint;
    nonce: bigint;
    out: string;
    proofFields: string[];
    digest: string;
    secretId: number;
  } | null = null;
  private timer: ReturnType<typeof setInterval> | undefined;
  private pauseTimer: ReturnType<typeof setTimeout> | undefined;
  private domain: string | undefined;
  private prover: Prover;
  private generations = 0;
  private crashes = 0;
  private refreshing: Promise<void> = Promise.resolve();
  /** Bumped per refresh; a read that outlived its deadline must not write over a newer one. */
  private reads = 0;
  private lastRead = Date.now();
  private offline = false;
  /** When the chain view was last rebuilt; a block that survives a rebuild gets the pause instead. */
  private rebuiltAt: number | null = null;
  /** A rebuilt view that has not been read yet: Start reads it before anything mines. */
  private unread = false;
  private reading: Promise<void> | undefined;
  /** Why mining is paused by the page itself (not the user); it resumes when the reason clears. */
  private pausedBy = new Set<PauseReason>();
  private resumeWhenClear = false;
  lastClaim: LastClaim | undefined;

  constructor(o: MinerOptions) {
    this.store = o.store;
    this.spawnWorker = o.spawnWorker;
    this.threads = o.threads;
    this.d = o.deployment;
    this.account = o.account;
    this.fee = o.fee;
    this.chainId = o.chainId;
    this.rollupVersion = o.rollupVersion;
    this.recover = o.recover;
    this.readDeadlineMs = o.readDeadlineMs ?? READ_DEADLINE_MS;
    this.prover = this.attach();
  }

  /**
   * Spawns a Worker and starts its prover. Messages from a superseded generation are ignored, so
   * a crashed Worker's late events cannot touch the state of its replacement.
   */
  private attach(): Prover {
    const generation = ++this.generations;
    const worker = this.spawnWorker();
    let initialised = false;
    const ready = new Promise<void>((resolve, reject) => {
      worker.onmessage = (e: MessageEvent<FromWorker>) => {
        if (this.generations !== generation) return;
        if (e.data.type === 'ready') {
          initialised = true;
          resolve();
        }
        if (e.data.type === 'error') {
          reject(new Error(e.data.message));
          if (!initialised) return this.abandonProver(`prover failed to start: ${e.data.message}`);
        }
        this.onWorker(e.data);
      };
      worker.onerror = (e) => {
        reject(new Error(e.message));
        if (this.generations !== generation) return;
        if (!initialised) return this.abandonProver(`prover failed to start: ${e.message}`);
        this.replaceProver(`worker crashed: ${e.message}`);
      };
    });
    ready.catch(() => {});
    worker.postMessage({ type: 'init', threads: this.threads } satisfies ToWorker);
    return { worker, ready, generation };
  }

  /** A crash after a successful start is replaced, a bounded number of times per page lifetime. */
  private replaceProver(reason: string) {
    this.prover.worker.terminate();
    this.dispatch({ type: 'failed', error: reason });
    this.log(reason);
    if (++this.crashes >= MAX_CRASHES) return this.abandonProver('prover keeps crashing; reload the page');
    this.prover = this.attach();
  }

  /**
   * Terminal: a failure before the prover ever became ready would repeat identically, and a prover
   * that keeps crashing is not worth another Worker. The reducer refuses `start` from here on.
   */
  private abandonProver(reason: string) {
    this.prover.worker.terminate();
    this.generations++;
    this.dispatch({ type: 'prover-dead', error: reason });
    this.log(reason);
  }

  /** Prover readiness for callers that must not race the init handshake; rejects on init failure. */
  ready(): Promise<void> {
    return this.prover.ready;
  }

  /** Test hook: makes the Worker throw, which takes the same path as any real crash. */
  crashProver() {
    this.prover.worker.postMessage({ type: 'crash' } satisfies ToWorker);
  }

  log(line: string) {
    this.store.set(logAtom, (l) => [...l.slice(-199), `${new Date().toISOString().slice(11, 19)} ${line}`]);
  }

  async begin() {
    this.domain = (
      await deployDomain(this.chainId, this.rollupVersion, this.d.miner.address.toField(), PARAMS.VERSION)
    ).toString();
    await this.refresh();
    this.timer = setInterval(() => void this.poll(), EPOCH_POLL_MS);
  }

  /** Ends the timers and the Worker; the page (or a failed boot) owns nothing of this afterwards. */
  dispose() {
    if (this.timer) clearInterval(this.timer);
    if (this.pauseTimer) clearTimeout(this.pauseTimer);
    this.generations++;
    this.prover.worker.terminate();
  }

  /** Under a page-side pause the intent is kept: mining starts when the last reason clears. */
  start() {
    if (this.pausedBy.size) {
      this.resumeWhenClear = true;
      return;
    }
    if (this.unread) return void this.readRebuilt();
    const epoch = this.store.get(epochAtom);
    if (epoch) this.dispatch({ type: 'start', epoch });
  }

  stop() {
    this.resumeWhenClear = false;
    this.dispatch({ type: 'stop' });
  }

  /** Power: the Worker finishes the proof in flight, rebuilds bb.js and resumes at the next nonce. */
  reconfigure(threads: number) {
    if (threads === this.threads) return;
    this.threads = threads;
    this.post({ type: 'reconfigure', threads });
    this.log(`power: ${threads} threads`);
  }

  get currentThreads(): number {
    return this.threads;
  }

  get deployment(): Deployment {
    return this.d;
  }

  get address(): AztecAddress {
    return this.account;
  }

  get feeSettings(): Fee {
    return this.fee;
  }

  /**
   * A page-side pause (battery, hidden tab, …): stops now, restarts by itself once every reason
   * clears. A claim or a rebuild in flight is left to finish; the restart they would have made
   * waits with the pause.
   */
  pause(reason: PauseReason) {
    const phase = this.store.get(minerAtom).phase;
    this.pausedBy.add(reason);
    if (phase === 'idle') return;
    if (phase === 'mining') this.dispatch({ type: 'stop' });
    this.resumeWhenClear = true;
  }

  release(reason: PauseReason) {
    this.pausedBy.delete(reason);
    if (this.pausedBy.size || !this.resumeWhenClear) return;
    this.resumeWhenClear = false;
    this.start();
  }

  /**
   * Re-reads the open epoch and the balance. Refreshes are serialised and an older epoch never
   * overwrites a newer one, so a slow poll cannot restart mining on stale parameters. A read past
   * the deadline fails the refresh; if it lands after a newer refresh began, it writes nothing.
   */
  refresh(): Promise<void> {
    const run = this.refreshing.then(() => {
      const gen = ++this.reads;
      return deadline(this.readChain(gen), this.readDeadlineMs);
    });
    this.refreshing = run.catch(() => {});
    return run;
  }

  /** The timer's refresh: a node silent for a minute pauses mining, its first answer resumes it. */
  private async poll() {
    // A rebuild swaps the deployment under the reads; its failures say nothing about the node.
    if (this.store.get(minerAtom).phase === 'recovering') return;
    try {
      await this.refresh();
      this.lastRead = Date.now();
      if (!this.offline) return;
      this.offline = false;
      this.log('node reachable again');
      this.dispatch({ type: 'online' });
      this.release('offline');
    } catch (e) {
      this.log(`refresh: ${claimFailureMessage(e)}`);
      if (this.offline || Date.now() - this.lastRead < OFFLINE_AFTER_MS) return;
      this.offline = true;
      this.log('node unreachable for a minute: mining paused');
      this.pause('offline');
      this.dispatch({ type: 'offline', since: this.lastRead });
    }
  }

  private async readChain(gen: number) {
    const epoch = await readEpoch(this.d, this.account);
    const previous = this.store.get(epochAtom);
    if (gen !== this.reads || (previous && epoch.epoch < previous.epoch)) return;
    this.store.set(epochAtom, epoch);
    if (previous && previous.epoch !== epoch.epoch) {
      this.log(`epoch ${epoch.epoch} opened (target ${epoch.target.toString(16)})`);
      this.dispatch({
        type: 'epoch',
        epoch,
        difficultyRatio: difficulty(epoch.target) / difficulty(previous.target),
        at: Date.now(),
      });
    }
    const balance = await readBalance(this.d, this.account);
    if (gen === this.reads) this.store.set(balanceAtom, balance);
  }

  /** Anyone may close an epoch that stayed open for T_MAX; the miner does it so mining resumes. */
  async roll() {
    this.log('rolling the epoch (T_MAX reached)');
    await sendRoll(this.d, this.account, this.fee);
    await this.refresh();
  }

  private dispatch(event: Event) {
    const [state, commands] = reduce(this.store.get(minerAtom), event);
    this.store.set(minerAtom, state);
    for (const c of commands) this.execute(c);
  }

  private execute(c: Command) {
    switch (c.type) {
      case 'mine': {
        const secret = newEpochSecret().toString();
        // Only the current secret is kept: a past epoch's tickets are worthless.
        this.secrets.clear();
        this.secrets.set(c.secretId, secret);
        const key = `${c.epoch}:${c.secretId}`;
        const job: MineJob = {
          epoch: c.epoch,
          seed: `0x${c.seed.toString(16)}`,
          domain: this.domain ?? '0x0',
          secret,
          target: c.target,
          secretId: c.secretId,
          recipient: this.account.toString(),
          startNonce: this.nextNonce.get(key) ?? 1n,
        };
        this.post({ type: 'mine', job });
        this.log(`mining epoch ${c.epoch} with a fresh secret`);
        return;
      }
      case 'halt':
        this.post({ type: 'stop' });
        return;
      case 'submit':
        void this.submit();
        return;
      case 'discard':
        this.log(`discarded a winning ticket: ${c.reason}`);
        this.pending = null;
        return;
    }
  }

  private post(m: ToWorker) {
    const prover = this.prover;
    void prover.ready.then(
      () => prover.worker.postMessage(m),
      () => {},
    );
  }

  private onWorker(m: FromWorker) {
    switch (m.type) {
      case 'attempt':
        this.dispatch({
          type: 'attempt',
          proveMs: m.proveMs,
          score: m.score,
          win: m.win,
          at: Date.now(),
          t: performance.now(),
        });
        return;
      case 'winner':
        this.log(`ticket wins after ${m.attempts} proofs (nonce ${m.nonce})`);
        this.pending = {
          epoch: m.epoch,
          nonce: m.nonce,
          out: m.out,
          proofFields: m.proofFields,
          digest: m.digest,
          secretId: m.secretId,
        };
        this.dispatch({ type: 'winner', epoch: m.epoch, secretId: m.secretId, at: Date.now() });
        return;
      case 'stopped':
        this.nextNonce.set(`${m.epoch}:${m.secretId}`, m.nextNonce);
        return;
      case 'error':
        if (this.generations === this.prover.generation) this.replaceProver(`worker: ${m.message}`);
        return;
      case 'ready':
        return;
    }
  }

  private async submit() {
    const p = this.pending;
    const secret = p && this.secrets.get(p.secretId);
    if (!p || !secret) return this.dispatch({ type: 'failed', error: 'no pending ticket' });
    this.pending = null;
    const before = this.store.get(epochAtom)?.claims ?? 0;
    this.log(`claiming in epoch ${p.epoch}: proving the claim in-page…`);
    try {
      const sent = await sendClaim(this.d, this.account, this.fee, { ...p, secret, recipient: this.account });
      const ttl = sent.expiresAt
        ? `expires ${new Date(sent.expiresAt * 1000).toISOString().slice(11, 19)}`
        : 'expiry unknown';
      this.log(`claim ${short(sent.txHash)} sent (${ttl})`);
      this.dispatch({ type: 'sent', txHash: sent.txHash, expiresAt: sent.expiresAt, at: Date.now() });
      const { block, effect } = await sent.wait();
      this.dispatch({ type: 'included', block, at: Date.now() });
      const marks = await claimMarks(effect, p.digest, this.d.miner.address);
      this.lastClaim = marks;
      await this.refresh();
      const reward = `${amount(PARAMS.REWARD, PARAMS.DECIMALS)} ${PARAMS.TOKEN_SYMBOL}`;
      this.log(`claim mined in block ${block}: +${reward}`);
      this.store.set(claimsAtom, (c) => [...c, { epoch: p.epoch, block, at: Date.now() }]);
      this.dispatch({
        type: 'claimed',
        block,
        reward,
        txHash: sent.txHash,
        nullifier: marks.nullifier,
        noteHash: marks.noteHash,
        noteHashes: marks.noteHashes.length,
        claims: [before, before + 1],
        at: Date.now(),
      });
      this.announceWin(block);
      this.start();
    } catch (e) {
      await this.claimFailed(e);
    }
  }

  /** Never an amount: the notification and the tab are the only things another app can read. */
  private announceWin(block: number) {
    const settings = this.store.get(settingsAtom);
    if (settings.sound) chime();
    if (settings.notify && typeof Notification !== 'undefined' && Notification.permission === 'granted')
      new Notification('Yacana · claim minted', {
        body: `A claim from this key landed in block ${block.toLocaleString('en-US')}.`,
        tag: 'yacana-claim',
      });
  }

  private async claimFailed(e: unknown) {
    const kind = classifyClaimFailure(e);
    const message = claimFailureMessage(e);
    this.log(`claim failed (${kind}): ${message}`);
    this.dispatch({ type: 'failed', error: message, kind, at: Date.now() });
    // Nothing was spent by an expired claim: mining goes on, on whatever epoch is open now.
    if (kind === 'expired') return this.start();
    if (kind !== 'reverted' && kind !== 'delivery-blocked') return;
    // A delivery still blocked after a rebuild is the PXE waiting for L1: only time helps.
    const rebuilt = this.rebuiltAt !== null && Date.now() - this.rebuiltAt < (await this.finalityMs());
    if (kind === 'delivery-blocked' && rebuilt) return this.pauseUntilFinal();
    await this.rebuildChainView();
  }

  /**
   * Drops and rebuilds the chain view. If the drop fails but the view could be reopened, the
   * account is still blocked and waits for finality on the reopened view; if nothing could be
   * reopened, the page has no working wallet and only a reload helps.
   */
  private async rebuildChainView() {
    this.log('lost a race: rebuilding this key’s chain view from the chain…');
    let rebound: Rebound;
    try {
      if (!this.recover) throw new Error('no recovery available');
      rebound = await this.recover();
    } catch (e) {
      this.log(`rebuild failed: ${claimFailureMessage(e)}`);
      return this.abandonProver(`the chain view could not be rebuilt: ${claimFailureMessage(e)}`);
    }
    this.d = rebound.deployment;
    this.fee = rebound.fee;
    if (!rebound.rebuilt) {
      this.log('the chain view could not be dropped; reopened as it was');
      return this.pauseUntilFinal();
    }
    this.rebuiltAt = Date.now();
    this.unread = true;
    await this.readRebuilt();
  }

  /**
   * The first read of a rebuilt view syncs the fresh PXE: the notes come back before mining
   * resumes. Until it succeeds nothing is known to be recovered, and Start retries it; one read
   * at a time, so a second Start cannot restart mining behind a Stop.
   */
  private readRebuilt(): Promise<void> {
    this.reading ??= this.readRebuiltOnce().finally(() => {
      this.reading = undefined;
    });
    return this.reading;
  }

  private async readRebuiltOnce() {
    try {
      await this.refresh();
    } catch (e) {
      this.log(`the rebuilt chain view could not be read: ${claimFailureMessage(e)}`);
      return this.dispatch({
        type: 'failed',
        error: `the chain view was rebuilt but the node did not answer (${claimFailureMessage(e)}); press Start to read it again`,
        at: Date.now(),
      });
    }
    this.unread = false;
    this.lastRead = Date.now();
    this.dispatch({ type: 'recovered', at: Date.now() });
    this.log('chain view rebuilt; mining resumes');
    this.start();
  }

  private async finalityMs(): Promise<number> {
    const seconds = await this.d.node
      .getL1Constants()
      .then(finalitySeconds)
      .catch(() => FALLBACK_FINALITY_S);
    return seconds * 1000;
  }

  /** The honest fallback: claims wait for L1 finality of the reverted one, then mining resumes. */
  private async pauseUntilFinal() {
    const until = Date.now() + (await this.finalityMs());
    this.log(`claims paused until ${new Date(until).toISOString().slice(11, 19)}`);
    this.pausedBy.add('lost-race');
    this.resumeWhenClear = true;
    this.dispatch({ type: 'paused', until, at: Date.now() });
    this.pauseTimer = setTimeout(() => this.release('lost-race'), until - Date.now());
  }
}
