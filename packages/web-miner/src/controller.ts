// Drives the reducer: chain reads on a timer, the Worker for proving, the wallet for claims.
import type { AztecAddress } from '@aztec/aztec.js/addresses';
import type { createStore } from 'jotai';
import { DELIVERY_BLOCKED_MESSAGE, isDeliveryBlockedError } from '../../miner-core/src/claim.ts';
import { PARAMS } from '../../miner-core/src/generated/params.ts';
import { difficulty } from '../../miner-core/src/metrics.ts';
import { deployDomain } from '../../miner-core/src/proof.ts';
import { newEpochSecret } from '../../miner-core/src/secret.ts';
import { type Deployment, type Fee, readBalance, readEpoch, sendClaim, sendRoll } from './chain';
import { amount } from './lib/format';
import { type Command, type Event, reduce } from './lib/reducer';
import { balanceAtom, claimsAtom, epochAtom, logAtom, minerAtom } from './state';
import type { FromWorker, MineJob, ToWorker } from './worker-protocol';

type Store = ReturnType<typeof createStore>;

const EPOCH_POLL_MS = 10_000;
const MAX_CRASHES = 3;

interface Prover {
  worker: Worker;
  ready: Promise<void>;
  generation: number;
}

export class MinerController {
  private secrets = new Map<number, string>();
  private nextNonce = new Map<string, bigint>();
  private pending: {
    epoch: bigint;
    nonce: bigint;
    out: string;
    proofFields: string[];
    secretId: number;
  } | null = null;
  private timer: ReturnType<typeof setInterval> | undefined;
  private domain: string | undefined;
  private prover: Prover;
  private generations = 0;
  private crashes = 0;
  private refreshing: Promise<void> = Promise.resolve();
  /** Why mining is paused by the page itself (not the user); it resumes when the reason clears. */
  private pausedBy = new Set<'battery' | 'hidden'>();

  constructor(
    private readonly store: Store,
    private readonly spawnWorker: () => Worker,
    private threads: number,
    private readonly d: Deployment,
    private readonly account: AztecAddress,
    private readonly fee: Fee,
    private readonly chainId: bigint,
    private readonly rollupVersion: bigint,
  ) {
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
    this.timer = setInterval(
      () => void this.refresh().catch((e) => this.log(`refresh: ${String(e)}`)),
      EPOCH_POLL_MS,
    );
  }

  dispose() {
    if (this.timer) clearInterval(this.timer);
  }

  start() {
    if (this.pausedBy.size) return;
    const epoch = this.store.get(epochAtom);
    if (epoch) this.dispatch({ type: 'start', epoch });
  }

  stop() {
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

  /** A page-side pause (battery, hidden tab): stops now, restarts by itself once every reason clears. */
  pause(reason: 'battery' | 'hidden') {
    const wasMining = this.store.get(minerAtom).phase === 'mining';
    this.pausedBy.add(reason);
    if (wasMining) {
      this.stop();
      this.resumeWhenClear = true;
    }
  }

  private resumeWhenClear = false;

  release(reason: 'battery' | 'hidden') {
    this.pausedBy.delete(reason);
    if (this.pausedBy.size || !this.resumeWhenClear) return;
    this.resumeWhenClear = false;
    this.start();
  }

  /**
   * Re-reads the open epoch and the balance. Refreshes are serialised and an older epoch never
   * overwrites a newer one, so a slow poll cannot restart mining on stale parameters.
   */
  refresh(): Promise<void> {
    const run = this.refreshing.then(() => this.readChain());
    this.refreshing = run.catch(() => {});
    return run;
  }

  private async readChain() {
    const epoch = await readEpoch(this.d, this.account);
    const previous = this.store.get(epochAtom);
    if (previous && epoch.epoch < previous.epoch) return;
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
    this.store.set(balanceAtom, await readBalance(this.d, this.account));
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
          secretId: m.secretId,
        };
        this.dispatch({ type: 'winner', epoch: m.epoch, secretId: m.secretId });
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
    this.log(`claiming in epoch ${p.epoch}: proving the claim in-page…`);
    try {
      const block = await sendClaim(this.d, this.account, this.fee, {
        ...p,
        secret,
        recipient: this.account,
      });
      const reward = `${amount(PARAMS.REWARD, PARAMS.DECIMALS)} ${PARAMS.TOKEN_SYMBOL}`;
      this.log(`claim mined in block ${block}: +${reward}`);
      this.store.set(claimsAtom, (c) => [...c, { epoch: p.epoch, block, at: Date.now() }]);
      this.dispatch({ type: 'claimed', block, reward, at: Date.now() });
      await this.refresh();
      this.start();
    } catch (e) {
      const message = isDeliveryBlockedError(e)
        ? DELIVERY_BLOCKED_MESSAGE
        : e instanceof Error
          ? (e.message.split('\n')[0] ?? '')
          : String(e);
      this.log(`claim failed: ${message}`);
      this.dispatch({ type: 'failed', error: message, at: Date.now() });
    }
  }
}
