// The versioned origin as the miner shows it: the retired head under the old role, the key screen
// that restores but never creates, and the old-tab notice that asks the served record when the tab
// comes back to the front.
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createStore, Provider } from 'jotai';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { isOldRole } from './bridge/env';
import { OldApp } from './features/OldApp';
import { OldTabNotice, staleTab } from './features/OldTabNotice';
import { SignInDialog } from './features/SignInDialog';
import type { Session } from './session';
import { bootAtom, signInAtom } from './state';

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
beforeEach(() => {
  vi.stubEnv('VITE_ROLLUP_VERSION', '5');
  vi.stubEnv('VITE_RP_ID', 'yacana.network');
  vi.stubGlobal('matchMedia', () => ({
    matches: false,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
});

describe('the old role', () => {
  test('is a build flag; the retired head says where mining went and what still moves; signed out, the way in', () => {
    vi.stubEnv('VITE_APP_ROLE', 'apex');
    expect(isOldRole()).toBe(false);
    vi.stubEnv('VITE_APP_ROLE', 'old');
    expect(isOldRole()).toBe(true);
    render(
      <Provider store={createStore()}>
        <OldApp />
      </Provider>,
    );
    const head = screen.getByTestId('retired');
    expect(head.dataset.state).toBe('live');
    expect(head.textContent).toContain('Send what’s still here ahead.');
    expect(head.textContent).toContain('Mining moved to the next version at yacana.network.');
    expect(head.textContent).toContain('send it ahead to the next version now, or bridge it to Ethereum.');
    // Signed out: no chip (nothing reads Ethereum without an account), the way in, and no cockpit.
    expect(screen.queryByTestId('proof-chip')).toBeNull();
    expect(screen.getByTestId('sign-in-mine').textContent).toBe('Log in');
    expect(screen.getByTestId('old-card').textContent).toContain('Accounts are restored here, not created.');
    expect(screen.queryByTestId('start')).toBeNull();
  });

  test('with the node retired the page reads nothing: no log in, no chip but the fact, the apex one link away', () => {
    vi.stubEnv('VITE_APP_ROLE', 'old');
    vi.stubEnv('VITE_LIFECYCLE', JSON.stringify({ stoppedProvingAt: '1800000000', nodeRetired: true }));
    render(
      <Provider store={createStore()}>
        <OldApp />
      </Provider>,
    );
    expect(screen.getByTestId('retired').textContent).toContain(
      'V5’s node has shut down. Nothing more can leave from here.',
    );
    expect(screen.getByTestId('proof-chip').textContent).toBe('V5’s node has shut down');
    expect(screen.getByTestId('open-apex').getAttribute('href')).toBe('https://yacana.network');
    expect(screen.queryByTestId('sign-in-mine')).toBeNull();
  });

  test('the versioned host restores and never creates: the dialog opens on Log in, with the note and no Start', () => {
    // jsdom's hostname is localhost; naming it the versioned origin makes this page that origin.
    vi.stubEnv('VITE_OLD_APP_ORIGIN', 'http://localhost');
    vi.stubEnv('VITE_SITE_MODE', 'production');
    const store = createStore();
    store.set(bootAtom, { phase: 'signedOut', slot: { record: null, staged: null, revision: 0 } });
    store.set(signInAtom, true); // the tile's button; nothing opens by itself on a device without an account
    render(
      <Provider store={store}>
        <SignInDialog session={{} as Session} />
      </Provider>,
    );
    expect(screen.getByText('Log in with the passkey you created, or your 12 words.')).toBeTruthy();
    expect(screen.getByTestId('host-note').textContent).toContain('Accounts are restored here, not created.');
    expect(screen.getByTestId('host-note').textContent).toContain('from yacana.network open it');
    expect(screen.queryByTestId('start-create')).toBeNull();
    expect(screen.queryByTestId('back')).toBeNull();
    expect((screen.getByTestId('restore-passkey') as HTMLButtonElement).disabled).toBe(false);
    expect(screen.getByTestId('restore-words')).toBeTruthy();
  });
});

describe('the old tab', () => {
  const mine = { miner: '0xABC', rollupVersion: '5' };

  test('another miner or rollup served at this address is stale; an unreadable record is not', () => {
    expect(staleTab(null, mine)).toBe(false);
    expect(staleTab({}, mine)).toBe(false);
    expect(staleTab({ miner: '0xabc', rollupVersion: '5' }, mine)).toBe(false);
    expect(staleTab({ miner: '0xabc', rollupVersion: '6' }, mine)).toBe(true);
    expect(staleTab({ miner: '0xdef', rollupVersion: '5' }, mine)).toBe(true);
  });

  test('a tab brought back to the front asks the served record at once and says reload when it is behind', async () => {
    let served = { miner: '0xabc', rollupVersion: '5' };
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(served)));
    vi.stubGlobal('fetch', fetchMock);
    render(<OldTabNotice miner={mine.miner} rollupVersion={mine.rollupVersion} />);
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(screen.queryByTestId('old-tab')).toBeNull();
    served = { miner: '0xdef', rollupVersion: '5' };
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await waitFor(() => expect(screen.getByTestId('old-tab').textContent).toContain('This tab is behind.'));
    expect(fetchMock).toHaveBeenCalledWith('/build.json', { cache: 'no-store' });
    fireEvent.click(screen.getByRole('button', { name: 'Reload' }));
  });
});
