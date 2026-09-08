import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createStore, Provider } from 'jotai';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import type { MinerController } from './controller';
import { SignInDialog } from './features/SignInDialog';
import { useHotkeys } from './features/use-page-behaviour';
import type { MasterRecord } from './keys/store';
import { initialSteps } from './opening-steps';
import { Mine } from './routes/Mine';
import type { Session } from './session';
import { bootAtom, epochAtom, nowAtom, rulesAtom, signInAtom } from './state';

afterEach(cleanup);
// jsdom has no matchMedia; the score loop's reduced-motion hook reads it.
beforeEach(() =>
  vi.stubGlobal('matchMedia', () => ({
    matches: false,
    addEventListener: () => {},
    removeEventListener: () => {},
  })),
);

const session = {
  createWithPasskey: vi.fn(async () => {}),
  open: vi.fn(async () => {}),
  restoreWithPasskey: vi.fn(async () => {}),
  newWords: () => 'a b c d e f g h i j k l',
} as unknown as Session;
const record = {
  id: 'r1',
  v: 1,
  method: 'passkey',
  askEveryOpen: true,
  account: { address: `0x${'ab'.repeat(32)}`, index: 0 },
} as unknown as MasterRecord;

/** The cockpit and the dialog on a store that holds the chain and no account. */
function mount(records: MasterRecord[] = []) {
  const store = createStore();
  const nowSec = Math.floor(Date.now() / 1000);
  store.set(epochAtom, {
    epoch: 38n,
    seed: 7n,
    target: 1n << 122n,
    openedAt: BigInt(nowSec - 120),
    claims: 3,
  });
  store.set(rulesAtom, {
    N: 4,
    EXPECTED_EPOCH_SECONDS: 300n,
    T_MAX: 1200n,
    REWARD: 4_000_000_000_000_000_000n,
  });
  store.set(nowAtom, Date.now());
  store.set(bootAtom, { phase: 'signedOut', records });
  render(
    <Provider store={store}>
      <Mine controller={() => undefined} />
      <SignInDialog session={session} />
    </Provider>,
  );
  return store;
}

describe('the cockpit signed out', () => {
  test('is dull, shows the epoch, swaps Start for Sign in to mine, and the dialog is open without a corner X', () => {
    mount();
    expect(screen.getByTestId('cockpit').hasAttribute('data-signed-out')).toBe(true);
    expect(screen.getByTestId('epoch-claims').textContent).toContain('3 of 4');
    expect(screen.getByTestId('sign-in-mine').textContent).toBe('Sign in to mine');
    expect(screen.queryByTestId('start')).toBeNull();
    expect(screen.getByTestId('sign-in')).toBeTruthy();
    expect(screen.getByTestId('create-passkey')).toBeTruthy();
    expect(screen.queryByLabelText('Close')).toBeNull();
    expect(screen.getByTestId('balance').textContent).toBe('—');
  });

  test('Not now leaves the cockpit dull; either sign-in button reopens the dialog', async () => {
    const store = mount();
    fireEvent.click(screen.getByTestId('not-now'));
    await waitFor(() => expect(screen.queryByTestId('sign-in')).toBeNull());
    expect(store.get(signInAtom)).toBe(false);
    expect(screen.getByTestId('cockpit').hasAttribute('data-signed-out')).toBe(true);
    fireEvent.click(screen.getByTestId('sign-in-mine'));
    await waitFor(() => expect(screen.getByTestId('sign-in')).toBeTruthy());
    fireEvent.click(screen.getByTestId('not-now'));
    await waitFor(() => expect(screen.queryByTestId('sign-in')).toBeNull());
    fireEvent.click(screen.getByTestId('sign-in-balance'));
    await waitFor(() => expect(screen.getByTestId('sign-in')).toBeTruthy());
  });

  test('a returning device gets Welcome back with the saved account, Open and the same way out', () => {
    mount([record]);
    expect(screen.getByText('Welcome back.')).toBeTruthy();
    expect(screen.getByTestId('key-address').textContent).toContain('0xababab');
    expect(screen.getByTestId('open-key')).toBeTruthy();
    expect(screen.getByTestId('not-now')).toBeTruthy();
  });
});

describe('the opening body', () => {
  test('the bar reflects the step states and the notes step is indeterminate', () => {
    const store = createStore();
    const steps = initialSteps('passkey');
    const crs = steps.find((x) => x.id === 'crs');
    if (crs) {
      crs.state = 'active';
      crs.bytes = { loaded: 5, total: 20 };
    }
    store.set(bootAtom, { phase: 'opening', steps });
    render(
      <Provider store={store}>
        <SignInDialog session={session} />
      </Provider>,
    );
    const bar = screen.getByTestId('opening-bar');
    // key 5 + node 5 + crs 70×0.25 = 27.5 → 28; determinate here.
    expect(bar.getAttribute('aria-valuenow')).toBe('28');
    expect(bar.hasAttribute('data-indeterminate')).toBe(false);
    // Cancel is available: the ceremony (the key step) is done.
    expect((screen.getByTestId('opening-cancel') as HTMLButtonElement).disabled).toBe(false);
  });

  test('Cancel is disabled while the ceremony (the key step) is still active', () => {
    const store = createStore();
    const steps = initialSteps('passkey');
    const key = steps.find((x) => x.id === 'key');
    if (key) key.state = 'active';
    store.set(bootAtom, { phase: 'opening', steps });
    render(
      <Provider store={store}>
        <SignInDialog session={session} />
      </Provider>,
    );
    expect((screen.getByTestId('opening-cancel') as HTMLButtonElement).disabled).toBe(true);
  });
});

describe('the page hotkeys', () => {
  test('do nothing while the dialog is open, and work once it is closed', () => {
    const start = vi.fn();
    const controller = () => ({ start, stop: vi.fn(), reconfigure: vi.fn() }) as unknown as MinerController;
    function Keys({ enabled }: { enabled: boolean }) {
      useHotkeys(controller, enabled);
      return null;
    }
    const { rerender } = render(
      <Provider store={createStore()}>
        <Keys enabled={false} />
      </Provider>,
    );
    fireEvent.keyDown(window, { key: ' ' });
    expect(start).not.toHaveBeenCalled();
    rerender(
      <Provider store={createStore()}>
        <Keys enabled />
      </Provider>,
    );
    fireEvent.keyDown(window, { key: ' ' });
    expect(start).toHaveBeenCalledTimes(1);
  });
});
