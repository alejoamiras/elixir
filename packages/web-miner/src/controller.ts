// Drives the reducer: chain reads on a timer, the Worker for proving, the wallet for claims.
import type { AztecAddress } from '@aztec/aztec.js/addresses';
import type { createStore } from 'jotai';
import { PARAMS } from '../../miner-core/src/generated/params.ts';
import { deployDomain } from '../../miner-core/src/proof.ts';
import { newEpochSecret } from '../../miner-core/src/secret.ts';
import { crossCheck, type Deployment, type Fee, readBalance, readEpoch, sendClaim, sendRoll } from './chain';
import type { Connection } from './config';
import { type Command, type Event, reduce } from './lib/reducer';
import { balanceAtom, claimsAtom, epochAtom, logAtom, minerAtom } from './state';
import type { FromWorker, MineJob, ToWorker } from './worker-protocol';

type Store = ReturnType<typeof createStore>;

const EPOCH_POLL_MS = 10_000;

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
  private worker: Worker;
  private workerReady: Promise<void>;

  constructor(
    private readonly store: Store,
    private readonly spawnWorker: () => Worker,
    private readonly threads: number,
    private readonly d: Deployment,
    private readonly account: AztecAddress,
    private readonly fee: Fee,
    private readonly connection: Connection,
    private readonly chainId: bigint,
  ) {
    [this.worker, this.workerReady] = this.attach(spawnWorker());
  }

  /** Wires a Worker and starts its prover; resolves once the CRS and circuit are loaded. */
  private attach(worker: Worker): [Worker, Promise<void>] {
    const ready = new Promise<void>((resolve, reject) => {
      worker.onmessage = (e: MessageEvent<FromWorker>) => {
        if (e.data.type === 'ready') resolve();
        this.onWorker(e.data);
      };
      worker.onerror = (e) => {
        reject(new Error(e.message));
        this.dispatch({ type: 'failed', error: `worker crashed: ${e.message}` });
      };
    });
    worker.postMessage({ type: 'init', threads: this.threads } satisfies ToWorker);
    return [worker, ready];
  }

  /** Prover readiness for callers that must not race the init handshake. */
  ready(): Promise<void> {
    return this.workerReady;
  }

  /** Test hook: kills the prover mid-job; the next start uses a fresh one. */
  crashProver() {
    this.worker.terminate();
    this.dispatch({ type: 'failed', error: 'worker crashed: terminated' });
    [this.worker, this.workerReady] = this.attach(this.spawnWorker());
  }

  log(line: string) {
    this.store.set(logAtom, (l) => [...l.slice(-199), `${new Date().toISOString().slice(11, 19)} ${line}`]);
  }

  async begin() {
    this.domain = (
      await deployDomain(this.chainId, this.d.miner.address.toField(), PARAMS.VERSION)
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
    const epoch = this.store.get(epochAtom);
    if (epoch) this.dispatch({ type: 'start', epoch });
  }

  stop() {
    this.dispatch({ type: 'stop' });
  }

  /** Re-reads the open epoch (cross-checked when configured) and the balance. */
  async refresh() {
    const epoch = await readEpoch(this.d, this.account);
    if (this.connection.crossCheckUrl) await crossCheck(this.d, this.connection.crossCheckUrl, epoch);
    const previous = this.store.get(epochAtom);
    this.store.set(epochAtom, epoch);
    if (previous && previous.epoch !== epoch.epoch) {
      this.log(`epoch ${epoch.epoch} opened (target ${epoch.target.toString(16)})`);
      this.dispatch({ type: 'epoch', epoch });
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
        this.secrets.set(c.secretId, secret);
        const key = `${c.epoch}:${c.secretId}`;
        const job: MineJob = {
          epoch: c.epoch,
          seed: `0x${c.seed.toString(16)}`,
          domain: this.domain ?? '0x0',
          secret,
          target: c.target,
          secretId: c.secretId,
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
    const worker = this.worker;
    void this.workerReady.then(
      () => worker.postMessage(m),
      () => {},
    );
  }

  private onWorker(m: FromWorker) {
    switch (m.type) {
      case 'attempt':
        this.dispatch({ type: 'attempt', proveMs: m.proveMs });
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
      case 'stopped': {
        this.nextNonce.set(`${m.epoch}:${m.secretId}`, m.nextNonce);
        // A halt issued by an epoch switch is followed by the new job; the Worker mines one at a time.
        const job = this.store.get(minerAtom).job;
        if (job && (job.epoch !== m.epoch || job.secretId !== m.secretId))
          this.execute({ type: 'mine', ...job });
        return;
      }
      case 'error':
        this.dispatch({ type: 'failed', error: m.message });
        this.log(`worker: ${m.message}`);
        return;
      case 'ready':
        return;
    }
  }

  private async submit() {
    const p = this.pending;
    const secret = p && this.secrets.get(p.secretId);
    if (!p || !secret) return this.dispatch({ type: 'failed', error: 'no pending ticket' });
    this.log(`claiming in epoch ${p.epoch}: proving the claim in-page…`);
    try {
      const block = await sendClaim(this.d, this.account, this.fee, {
        ...p,
        secret,
        recipient: this.account,
      });
      this.log(
        `claim mined in block ${block}: +${PARAMS.REWARD / 10n ** BigInt(PARAMS.DECIMALS)} ${PARAMS.TOKEN_SYMBOL}`,
      );
      this.store.set(claimsAtom, (c) => [...c, { epoch: p.epoch, block, at: Date.now() }]);
      this.dispatch({ type: 'claimed' });
      await this.refresh();
      this.start();
    } catch (e) {
      const message = e instanceof Error ? (e.message.split('\n')[0] ?? '') : String(e);
      this.log(`claim failed: ${message}`);
      this.dispatch({ type: 'failed', error: message });
    } finally {
      this.pending = null;
    }
  }
}
