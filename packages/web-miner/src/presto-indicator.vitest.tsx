import { cleanup, render, screen } from '@testing-library/react';
import { createStore, Provider } from 'jotai';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { Shell } from './App';
import { initial } from './lib/reducer';
import { initialPresto, prestoAtom } from './presto';
import { Mine } from './routes/Mine';
import { bootAtom, epochAtom, minerAtom, nowAtom, rulesAtom } from './state';

afterEach(cleanup);
beforeEach(() =>
  vi.stubGlobal('matchMedia', () => ({
    matches: false,
    addEventListener: () => {},
    removeEventListener: () => {},
  })),
);

const mining = () => {
  const store = createStore();
  store.set(minerAtom, { ...initial, phase: 'mining', recent: [840, 850], proofs: 12, samples: [] });
  store.set(bootAtom, {
    phase: 'ready',
    account: '0x1',
    threads: 11,
    record: {
      v: 1,
      id: 'r',
      method: 'words',
      createdAt: 0,
      askEveryOpen: false,
      backedUp: true,
      account: { address: '0x1', index: 0 },
    },
  });
  store.set(epochAtom, { epoch: 71n, seed: 7n, target: 1n << 122n, openedAt: 0n, claims: 3 });
  store.set(rulesAtom, { N: 4, EXPECTED_EPOCH_SECONDS: 300n, T_MAX: 1200n, REWARD: 4n * 10n ** 18n });
  store.set(nowAtom, Date.now());
  return store;
};

describe('the native indicator', () => {
  test('the pill gains ✦ presto only while a native proof is what proved last; it drops with the WASM message', () => {
    const store = mining();
    store.set(prestoAtom, { ...initialPresto, selected: 'presto', active: null });
    const { rerender } = render(
      <Provider store={store}>
        <Shell>
          <p />
        </Shell>
      </Provider>,
    );
    // Selected is not proved: nothing yet.
    expect(screen.getByTestId('phase').textContent).toBe('mining');
    expect(screen.queryByTestId('native')).toBeNull();
    store.set(prestoAtom, { ...initialPresto, selected: 'presto', active: 'presto' });
    rerender(
      <Provider store={store}>
        <Shell>
          <p />
        </Shell>
      </Provider>,
    );
    expect(screen.getByTestId('native').textContent).toContain('presto');
    expect(screen.getByTestId('phase').getAttribute('data-prover')).toBe('presto');
    store.set(prestoAtom, { ...initialPresto, selected: 'presto', active: 'wasm', fallbackReason: 'denied' });
    rerender(
      <Provider store={store}>
        <Shell>
          <p />
        </Shell>
      </Provider>,
    );
    expect(screen.queryByTestId('native')).toBeNull();
    expect(screen.getByTestId('phase').getAttribute('data-prover')).toBe('wasm');
  });

  test("the rate line says native and the rail's slider dims with Presto's speed setting named; both revert", () => {
    const store = mining();
    store.set(prestoAtom, { ...initialPresto, selected: 'presto', active: 'presto' });
    const { container, rerender } = render(
      <Provider store={store}>
        <Mine controller={() => undefined} />
      </Provider>,
    );
    expect(screen.getByTestId('rate-line').textContent).toContain('native');
    expect(screen.getByTestId('rate-line').textContent).not.toContain('threads');
    expect((screen.getByRole('slider') as HTMLInputElement).disabled).toBe(true);
    expect(screen.getByTestId('power-caption').textContent).toContain('speed setting');
    store.set(prestoAtom, { ...initialPresto, selected: 'presto', active: 'wasm' });
    rerender(
      <Provider store={store}>
        <Mine controller={() => undefined} />
      </Provider>,
    );
    expect(screen.getByTestId('rate-line').textContent).toContain('11 threads');
    expect((screen.getByRole('slider') as HTMLInputElement).disabled).toBe(false);
    expect(screen.getByTestId('power-caption').textContent).toContain('one stays with the page');
    expect(container.querySelector('[data-slot=power-slider]')?.getAttribute('data-disabled')).toBeNull();
  });
});
