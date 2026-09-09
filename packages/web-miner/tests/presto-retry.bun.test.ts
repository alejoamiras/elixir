// The controller's side of a Retry and a Start against a fake Worker: an unchanged config posts
// nothing, a forced one rebuilds, the page's view of Presto follows the Worker's messages and is
// cleared by a rebuild, and Stop is counted so a probe that outlived one can tell.
import { describe, expect, test } from 'bun:test';
import { AztecAddress } from '@aztec/aztec.js/addresses';
import { createStore } from 'jotai';
import type { Deployment, Fee } from '../src/chain.ts';
import { MinerController } from '../src/controller.ts';
import { PRESTO_DEFAULT, prestoAtom } from '../src/presto.ts';
import type { FromWorker, ToWorker } from '../src/worker-protocol.ts';

class FakeWorker {
  onmessage: ((e: MessageEvent<FromWorker>) => void) | null = null;
  onerror: ((e: ErrorEvent) => void) | null = null;
  sent: ToWorker[] = [];
  postMessage(m: ToWorker) {
    this.sent.push(m);
    if (m.type === 'init' || m.type === 'reconfigure')
      queueMicrotask(() =>
        this.emit({ type: 'ready', threads: m.threads, initMs: 0, prover: m.presto ? 'presto' : 'wasm' }),
      );
  }
  terminate() {}
  emit(m: FromWorker) {
    this.onmessage?.({ data: m } as MessageEvent<FromWorker>);
  }
}

const tick = () => new Promise((r) => setTimeout(r, 0));
const reconfigures = (w: FakeWorker) => w.sent.filter((m) => m.type === 'reconfigure');

function controller(worker: FakeWorker) {
  const store = createStore();
  const c = new MinerController({
    store,
    spawnWorker: () => worker as unknown as Worker,
    threads: 2,
    presto: PRESTO_DEFAULT,
    deployment: {} as Deployment,
    account: AztecAddress.fromBigIntUnsafe(11n),
    fee: {} as Fee,
    chainId: 1n,
    rollupVersion: 1n,
  });
  return { store, c };
}

describe('reconfigure for Presto', () => {
  test('the same config posts nothing; force rebuilds; dropping the endpoint rebuilds on WASM', async () => {
    const worker = new FakeWorker();
    const { store, c } = controller(worker);
    await c.ready();
    expect(store.get(prestoAtom).selected).toBe('presto');
    c.reconfigure(2, PRESTO_DEFAULT);
    c.reconfigure(2, { ...PRESTO_DEFAULT });
    await tick();
    expect(reconfigures(worker)).toEqual([]);
    c.reconfigure(2, PRESTO_DEFAULT, { force: true });
    await tick();
    expect(reconfigures(worker)).toEqual([{ type: 'reconfigure', threads: 2, presto: PRESTO_DEFAULT }]);
    c.reconfigure(2, null);
    await tick();
    expect(reconfigures(worker)).toHaveLength(2);
    expect(c.currentPresto).toBeNull();
    expect(store.get(prestoAtom).selected).toBe('wasm');
    c.dispose();
  });

  test('a sticky fallback is the Worker’s verdict until a rebuild; Stop is counted', async () => {
    const worker = new FakeWorker();
    const { store, c } = controller(worker);
    await c.ready();
    worker.emit({ type: 'prover', kind: 'wasm', sticky: true, reason: 'denied' });
    expect(store.get(prestoAtom)).toMatchObject({ active: 'wasm', fallbackReason: 'denied' });
    c.reconfigure(2, PRESTO_DEFAULT, { force: true });
    await tick();
    expect(store.get(prestoAtom)).toMatchObject({
      selected: 'presto',
      active: null,
      fallbackReason: undefined,
    });
    expect(c.stopCount).toBe(0);
    c.stop();
    c.stop();
    expect(c.stopCount).toBe(2);
    c.dispose();
    expect(store.get(prestoAtom).selected).toBeNull();
  });
});
