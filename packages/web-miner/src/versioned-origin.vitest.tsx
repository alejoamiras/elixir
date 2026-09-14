// The versioned origin as the miner shows it: the retired head under the old role, the key screen
// that restores but never creates, and the old-tab notice that asks the served record when the tab
// comes back to the front.
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createStore, Provider } from 'jotai';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { isOldRole } from './bridge/env';
import { CreateKey } from './features/KeyScreen';
import { OldApp } from './features/OldApp';
import { OldTabNotice, staleTab } from './features/OldTabNotice';
import type { Session } from './session';

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
  test('is a build flag; the retired head names the version and what still moves', () => {
    vi.stubEnv('VITE_APP_ROLE', 'apex');
    expect(isOldRole()).toBe(false);
    vi.stubEnv('VITE_APP_ROLE', 'old');
    expect(isOldRole()).toBe(true);
    vi.stubEnv('VITE_RP_ID', 'yacana.network');
    render(
      <Provider store={createStore()}>
        <OldApp />
      </Provider>,
    );
    const head = screen.getByTestId('retired');
    expect(head.textContent).toContain('Send what is still here ahead.');
    expect(head.textContent).toContain('Mining has ended on this version.');
    expect(head.textContent).toContain('send ahead to the next version, or to Ethereum');
    expect(head.textContent).toContain('it goes quiet after the upgrade, without notice.');
    // Signed out: the way in, and no cockpit.
    expect(screen.getByTestId('sign-in-mine').textContent).toContain('Open with passkey');
    expect(screen.queryByTestId('start')).toBeNull();
  });

  test('the versioned host restores and never creates, and the key screen says so', () => {
    // jsdom's hostname is localhost; naming it the versioned origin makes this page that origin.
    vi.stubEnv('VITE_OLD_APP_ORIGIN', 'http://localhost');
    vi.stubEnv('VITE_SITE_MODE', 'production');
    render(<CreateKey session={{} as Session} />);
    expect(screen.getByTestId('host-note').textContent).toContain('Accounts are restored here, not created.');
    expect((screen.getByTestId('create-passkey') as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByTestId('use-words') as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByTestId('restore-passkey') as HTMLButtonElement).disabled).toBe(false);
    expect((screen.getByTestId('restore-words') as HTMLButtonElement).disabled).toBe(false);
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
