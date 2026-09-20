import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { createStore, Provider } from 'jotai';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { ThemeProvider } from '../../ui/src/index.ts';
import type { Connection } from './config';
import { initialPresto } from './presto';
import { prestoWords, Settings } from './routes/Settings';
import type { Session } from './session';
import { bootAtom } from './state';

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
});
// jsdom has no matchMedia; the theme provider reads it for `system`.
beforeEach(() => {
  vi.stubGlobal('matchMedia', () => ({
    matches: false,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
  vi.stubEnv('VITE_SOURCE_COMMIT', '0d9d1ea1db43abcdef');
  vi.stubEnv('VITE_SITE_MODE', 'e2e');
  vi.stubEnv('VITE_BB_VERSION', '5.2.0');
  vi.stubEnv('VITE_AZTEC_NODE_URL', 'https://node.example/rpc');
});

const connection: Connection = {
  nodeUrl: 'https://node.example/rpc',
  ethRpcUrl: '',
  miner: '0x1',
  token: '0x2',
  firstEpoch: 0,
};

const session = () =>
  ({
    nodeUrl: 'https://node.example/rpc',
    ethRpcUrl: '',
    probeNode: vi.fn(),
    switchNode: vi.fn(),
    setStayOpen: vi.fn(async () => {}),
    forget: vi.fn(async () => {}),
  }) as unknown as Session;

function mount(signedIn: boolean) {
  const store = createStore();
  if (signedIn)
    store.set(bootAtom, {
      phase: 'ready',
      account: '0x22a9db0000000000000000000000000000000000000000000000000000000612a',
      threads: 11,
      record: {
        v: 1,
        id: 'r',
        method: 'passkey',
        createdAt: 0,
        askEveryOpen: true,
        backedUp: true,
        account: { address: '0x22a9db0000000000000000000000000000000000000000000000000000000612a', index: 0 },
      },
    });
  return render(
    <Provider store={store}>
      <ThemeProvider defaultTheme="dark">
        <Settings connection={connection} controller={() => undefined} session={session()} />
      </ThemeProvider>
    </Provider>,
  );
}

describe('Settings', () => {
  test('the six sections in order, the slider’s sentence, Presto’s row before any probe, the about line; no diagnostics', () => {
    const { container } = mount(true);
    const headers = Array.from(container.querySelectorAll('[data-slot=tile-header]')).map(
      (h) => h.firstElementChild?.textContent,
    );
    expect(headers).toEqual(['network', 'mining power', 'alerts', 'account', 'appearance', 'about']);
    expect(container.textContent).toContain(
      'This slider affects browser proving only; one core stays with the page.',
    );
    expect(screen.getByTestId('presto-standing').textContent).toBe(
      'native prover, several times faster · checked when you start mining',
    );
    expect(screen.getByRole('link', { name: /Get Presto/ }).getAttribute('href')).toBe(
      'https://presto.build',
    );
    expect(screen.getByTestId('about-line').textContent).toContain(
      'Yacana runs in your browser. Whoever serves this page controls it; the source is public — run your own build if that matters.',
    );
    expect(screen.queryByTestId('copy-diagnostics')).toBeNull();
    expect(screen.getByTestId('node-chip')).toBeTruthy();
  });

  test('the account: address, method, Stay open with its two sentences, Sign out opens the hold dialog', () => {
    mount(true);
    expect(screen.getByTestId('settings-account').textContent).toBe('0x22a9db…612a');
    expect(screen.getByText('passkey')).toBeTruthy();
    const stay = screen.getByRole('switch', { name: /Stay open on this device/ });
    expect(stay.getAttribute('aria-checked')).toBe('false');
    expect(screen.getByText(/On: anyone who can use this browser could open and spend/).textContent).toBe(
      'On: anyone who can use this browser could open and spend from this account without your passkey. Off: one touch per open.',
    );
    fireEvent.click(screen.getByTestId('sign-out'));
    expect(screen.getByTestId('sign-out-dialog')).toBeTruthy();
  });

  test('signed out: the way in, and the node row still there', () => {
    mount(false);
    expect(screen.getByTestId('sign-in-settings')).toBeTruthy();
    expect(screen.queryByTestId('sign-out')).toBeNull();
    expect(screen.getByTestId('node-row')).toBeTruthy();
  });

  test('Presto’s words follow the probe and the prover', () => {
    const status = { protocol: 'https', available: true, needsDownload: false, schemes: ['ultra_honk'] };
    expect(prestoWords(initialPresto)).toBe('checked when you start mining');
    expect(prestoWords({ ...initialPresto, status: { ...status, available: false } } as never)).toBe(
      'not found',
    );
    expect(prestoWords({ ...initialPresto, status, active: 'presto' } as never)).toBe('connected ✦');
    expect(prestoWords({ ...initialPresto, status, fallbackReason: 'denied' } as never)).toContain(
      'Approve it in the Presto app',
    );
    expect(prestoWords({ ...initialPresto, status } as never)).toBe('found');
  });
});
