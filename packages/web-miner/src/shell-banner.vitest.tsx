import { cleanup, render, screen } from '@testing-library/react';
import { createStore, Provider } from 'jotai';
import { afterEach, describe, expect, test } from 'vitest';
import { resetNodeHealth, setTransportForTests } from '../../site/src/browser/node-health.ts';
import { Shell } from './App';

afterEach(() => {
  cleanup();
  resetNodeHealth();
});

describe('the shell and the node banner', () => {
  test('a throttled store puts the banner under the header, linking the Node settings', () => {
    setTransportForTests({ kind: 'throttled', retryAt: Date.now() + 12_000, status: 429, backoffMs: 15_000 });
    render(
      <Provider store={createStore()}>
        <Shell>
          <p>cockpit</p>
        </Shell>
      </Provider>,
    );
    const banner = screen.getByTestId('node-banner');
    expect(banner.getAttribute('data-kind')).toBe('throttled');
    expect(screen.getByTestId('node-settings-link').getAttribute('href')).toMatch(/settings$/);
    expect(screen.getByText('cockpit')).toBeTruthy();
  });

  test('a healthy store shows no banner', () => {
    render(
      <Provider store={createStore()}>
        <Shell>
          <p>cockpit</p>
        </Shell>
      </Provider>,
    );
    expect(screen.queryByTestId('node-banner')).toBeNull();
  });
});
