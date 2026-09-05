// bun: the controller's lost-race path against a fake worker and fake contracts. The reset is
// injected (`recover`), so what is checked here is the orchestration: the rebuilt view is read
// (re-sync), mining resumes on it, and a delivery still blocked after a rebuild gets the pause.
import { beforeEach, describe, expect, test } from 'bun:test';
import { AztecAddress } from '@aztec/aztec.js/addresses';
import { createStore } from 'jotai';
import type { Deployment, Fee } from '../src/chain.ts';
import { MinerController, type Rebound } from '../src/controller.ts';
import { balanceAtom, minerAtom } from '../src/state.ts';
import type { FromWorker, ToWorker } from '../src/worker-protocol.ts';

class FakeWorker {
  onmessage: ((e: MessageEvent<FromWorker>) => void) | null = null;
  onerror: ((e: ErrorEvent) => void) | null = null;
  sent: ToWorker[] = [];
  postMessage(m: ToWorker) {
    this.sent.push(m);
    if (m.type === 'init') queueMicrotask(() => this.emit({ type: 'ready', threads: 1, initMs: 0 }));
  }
  terminate() {}
  emit(m: FromWorker) {
    this.onmessage?.({ data: m } as MessageEvent<FromWorker>);
  }
}

const sim = (result: unknown) => ({ simulate: async () => ({ result }) });

/** The reads the controller makes, a claim whose send is scripted, and a balance to tell views apart. */
const fakeDeployment = (
  balance: bigint | (() => Promise<bigint>),
  send: () => Promise<unknown>,
  epoch: () => Promise<bigint> = async () => 3n,
): Deployment =>
  ({
    node: {
      getL1Constants: async () => ({ slotDuration: 36, epochDuration: 32, proofSubmissionEpochs: 1 }),
    },
    miner: {
      address: AztecAddress.fromBigIntUnsafe(7n),
      methods: {
        open_epoch: () => ({ simulate: async () => ({ result: await epoch() }) }),
        epoch_params: () => sim({ target: 1n << 122n, seed: 7n, opened_at: 0n }),
        claims_in: () => sim(1n),
        claim: () => ({ send }),
      },
    },
    token: {
      methods: {
        balance_of_private: () => ({
          simulate: async () => ({ result: typeof balance === 'bigint' ? balance : await balance() }),
        }),
      },
    },
    lastSent: () => undefined,
  }) as unknown as Deployment;

const fee = {
  paymentMethod: { getAsset: () => undefined },
  gasSettings: { gasLimits: {} },
} as unknown as Fee;
const account = AztecAddress.fromBigIntUnsafe(11n);
const winner: FromWorker = {
  type: 'winner',
  epoch: 3n,
  secretId: 1,
  nonce: 1n,
  out: '0x1',
  proofFields: [],
  digest: '0x2',
  attempts: 1,
};
const REVERTED = new Error(
  'Transaction 0x1 reverted: app_logic_reverted. Reason: Assertion failed: stale claim',
);
const BLOCKED = new Error('Simulation error: Nullifier read request failed for note 0x3');

const settle = async (done: () => boolean) => {
  for (let i = 0; i < 300 && !done(); i++) await new Promise((r) => setTimeout(r, 10));
  expect(done()).toBe(true);
};

describe('lost-race recovery', () => {
  let store: ReturnType<typeof createStore>;
  let worker: FakeWorker;
  beforeEach(() => {
    store = createStore();
    worker = new FakeWorker();
  });

  const boot = async (deployment: Deployment, recover: () => Promise<Rebound>, readDeadlineMs?: number) => {
    const controller = new MinerController({
      store,
      spawnWorker: () => worker as unknown as Worker,
      threads: 1,
      deployment,
      account,
      fee,
      chainId: 1n,
      rollupVersion: 1n,
      recover,
      readDeadlineMs,
    });
    await controller.ready();
    await controller.begin();
    controller.start();
    await settle(() => worker.sent.some((m) => m.type === 'mine'));
    return controller;
  };

  test('a reverted claim rebuilds the view, reads it, and mining resumes on the rebuilt deployment', async () => {
    let recovered = 0;
    const rebuilt = fakeDeployment(9n, () => Promise.reject(BLOCKED));
    const controller = await boot(
      fakeDeployment(5n, () => Promise.reject(REVERTED)),
      async () => {
        recovered++;
        return { deployment: rebuilt, fee, rebuilt: true };
      },
    );
    expect(store.get(balanceAtom)).toBe(5n);
    worker.emit(winner);
    await settle(() => store.get(minerAtom).phase === 'mining' && recovered === 1);
    expect(store.get(balanceAtom)).toBe(9n);
    expect(controller.deployment).toBe(rebuilt);
    expect(store.get(minerAtom).notice).toBeNull();
    expect(store.get(minerAtom).ledger.map((l) => l.kind)).toEqual(['epoch', 'failed']);
    expect(worker.sent.filter((m) => m.type === 'mine')).toHaveLength(2);

    // Still blocked right after the rebuild: the honest pause, not another rebuild.
    worker.emit({ ...winner, secretId: 2 });
    await settle(() => store.get(minerAtom).notice?.kind === 'paused');
    expect(recovered).toBe(1);
    const until = store.get(minerAtom).notice?.until ?? 0;
    expect(until - Date.now()).toBeGreaterThan(2 * 32 * 36 * 1000 - 5000);
    expect(store.get(minerAtom).phase).toBe('idle');
    controller.dispose();
  });

  test('a drop that fails but reopens falls back to the pause on the reopened view', async () => {
    const reopened = fakeDeployment(5n, () => Promise.reject(REVERTED));
    const controller = await boot(
      fakeDeployment(5n, () => Promise.reject(REVERTED)),
      async () => ({
        deployment: reopened,
        fee,
        rebuilt: false,
      }),
    );
    worker.emit(winner);
    await settle(() => store.get(minerAtom).notice?.kind === 'paused');
    expect(store.get(minerAtom).notice?.body).toContain('about 38 min');
    expect(controller.deployment).toBe(reopened);
    controller.dispose();
  });

  test('no wallet at all after a failed rebuild is terminal: reload', async () => {
    const controller = await boot(
      fakeDeployment(5n, () => Promise.reject(REVERTED)),
      () => Promise.reject(new Error('another tab holds this key’s chain view open')),
    );
    worker.emit(winner);
    await settle(() => store.get(minerAtom).proverDead);
    // The card carries the cause verbatim: here, what to do about the other tab.
    expect(store.get(minerAtom).notice?.kind).toBe('prover-dead');
    expect(store.get(minerAtom).notice?.body).toContain('another tab holds this key’s chain view open');
    expect(store.get(minerAtom).notice?.title).toContain('reload the page');
    controller.dispose();
  });

  test('an expired claim restarts on the epoch open now; a pause during the claim defers it', async () => {
    const controller = await boot(
      fakeDeployment(5n, () => Promise.reject(new Error('Invalid tx: Invalid expiration timestamp'))),
      () => Promise.reject(new Error('unused')),
    );
    worker.emit(winner);
    expect(store.get(minerAtom).phase).toBe('claiming');
    controller.pause('hidden');
    await settle(() => store.get(minerAtom).notice?.kind === 'expired');
    expect(store.get(minerAtom).phase).toBe('idle');
    expect(worker.sent.filter((m) => m.type === 'mine')).toHaveLength(1);
    controller.release('hidden');
    await settle(() => worker.sent.filter((m) => m.type === 'mine').length === 2);
    expect(store.get(minerAtom)).toMatchObject({ phase: 'mining', notice: { kind: 'expired' } });
    controller.dispose();
  });

  test('a rebuilt view that cannot be read is not declared recovered; Start reads it again', async () => {
    let reads = 0;
    const flaky = fakeDeployment(
      9n,
      () => Promise.reject(BLOCKED),
      async () => {
        if (reads++ === 0) throw new Error('fetch failed');
        return 3n;
      },
    );
    const controller = await boot(
      fakeDeployment(5n, () => Promise.reject(REVERTED)),
      async () => ({
        deployment: flaky,
        fee,
        rebuilt: true,
      }),
    );
    worker.emit(winner);
    await settle(() => store.get(minerAtom).notice?.kind === 'failed');
    expect(store.get(minerAtom)).toMatchObject({ phase: 'idle' });
    expect(store.get(minerAtom).notice?.body).toContain('press Start');
    expect(store.get(balanceAtom)).toBe(5n);
    // Start reads the rebuilt view first; only a successful read clears the card and mines.
    controller.start();
    await settle(() => store.get(minerAtom).phase === 'mining');
    expect(store.get(minerAtom).notice).toBeNull();
    expect(store.get(balanceAtom)).toBe(9n);
    expect(store.get(minerAtom).ledger.map((l) => l.kind)).toEqual(['epoch', 'failed', 'failed']);
    controller.dispose();
  });

  test('a read that outlives its deadline writes nothing over a newer one', async () => {
    let calls = 0;
    // Read 0 (boot) answers at once; read 1 answers late with a stale balance; read 2 at once.
    const balance = () =>
      new Promise<bigint>((resolve) => {
        const n = calls++;
        setTimeout(() => resolve(n === 1 ? 1n : n === 2 ? 2n : 5n), n === 1 ? 150 : 0);
      });
    const controller = await boot(
      fakeDeployment(balance, () => Promise.reject(REVERTED)),
      () => Promise.reject(new Error('unused')),
      50,
    );
    await expect(controller.refresh()).rejects.toThrow(/no answer/);
    await controller.refresh();
    expect(store.get(balanceAtom)).toBe(2n);
    await new Promise((r) => setTimeout(r, 150));
    expect(store.get(balanceAtom)).toBe(2n);
    controller.dispose();
  });
});
