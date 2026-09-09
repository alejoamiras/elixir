import type { PrestoStatus } from '@alejoamiras/presto-core';
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { createStore, Provider } from 'jotai';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { ThemeProvider } from '../../ui/src/index.ts';
import { PrestoBanner } from './features/PrestoBanner';
import { initialPresto, type PrestoState, prestoAtom } from './presto';
import { bootAtom } from './state';

// The billboard's script is loaded only when it shows: the mock records whether it ever was.
const registered = vi.fn();
vi.mock('@alejoamiras/presto-banners/register', () => {
  registered();
  return {};
});

afterEach(cleanup);
// jsdom has no matchMedia; the theme provider reads it for `system`.
beforeEach(() =>
  vi.stubGlobal('matchMedia', () => ({
    matches: false,
    addEventListener: () => {},
    removeEventListener: () => {},
  })),
);

const status = (s: Partial<PrestoStatus> & Record<string, unknown>): PrestoStatus =>
  ({ protocol: 'https', ...s }) as PrestoStatus;

function mount(presto: Partial<PrestoState>, onRetry = vi.fn()) {
  const store = createStore();
  store.set(prestoAtom, { ...initialPresto, ...presto });
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
  const utils = render(
    <Provider store={store}>
      <ThemeProvider defaultTheme="system">
        <PrestoBanner onRetry={onRetry} />
      </ThemeProvider>
    </Provider>,
  );
  return { ...utils, onRetry };
}

describe('PrestoBanner', () => {
  test('nothing before the probe answers, nothing while Presto proves, and no script loaded for either', () => {
    const a = mount({});
    expect(a.container.innerHTML).toBe('');
    a.unmount();
    const b = mount({ status: status({ available: true, needsDownload: false, schemes: ['ultra_honk'] }) });
    expect(b.container.innerHTML).toBe('');
    expect(registered).not.toHaveBeenCalled();
  });

  test('absent (HTTPS-only: nothing answered) mounts the billboard, loads its script then, no fonts', async () => {
    const { container } = mount({
      status: status({ available: false, reason: 'secure-connection-unavailable', diagnosis: 'unconfirmed' }),
    });
    const el = container.querySelector('presto-banner') as HTMLElement;
    expect(el).not.toBeNull();
    expect(el.getAttribute('variant')).toBe('billboard');
    expect(el.getAttribute('fonts')).toBe('none');
    expect(el.getAttribute('href')).toBe('https://presto.build');
    expect(el.getAttribute('theme')).toBe('auto');
    await waitFor(() => expect(registered).toHaveBeenCalledTimes(1));
    expect(container.querySelector('[data-testid=presto-notice]')).toBeNull();
  });

  test('present but in the way: the row with its words and a Retry that reaches the host; the download is an info row without one', () => {
    const blocked = mount({ status: status({ available: false, reason: 'permission-blocked' }) });
    const row = blocked.getByTestId('presto-notice');
    expect(row.dataset.tone).toBe('warn');
    expect(row.textContent).toContain('blocked local access');
    expect(row.textContent).toContain('browser · 11 threads');
    fireEvent.click(blocked.getByTestId('presto-retry'));
    expect(blocked.onRetry).toHaveBeenCalledTimes(1);
    expect(blocked.container.querySelector('presto-banner')).toBeNull();
    blocked.unmount();

    const denied = mount({
      status: status({ available: true, needsDownload: false, schemes: ['ultra_honk'] }),
      fallbackReason: 'denied',
    });
    expect(denied.getByTestId('presto-notice').textContent).toContain('Approve it in the Presto app');
    denied.unmount();

    const downloading = mount({
      status: status({ available: true, needsDownload: true, schemes: ['ultra_honk'] }),
      phase: 'downloading',
    });
    const info = downloading.getByTestId('presto-notice');
    expect(info.dataset.tone).toBe('info');
    expect(downloading.queryByTestId('presto-retry')).toBeNull();
  });
});
