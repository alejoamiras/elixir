import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { NodeBanner } from './node-banner.tsx';

afterEach(cleanup);

describe('NodeBanner', () => {
  test('renders nothing while the node is healthy', () => {
    render(<NodeBanner state={null} settingsHref="/mine/settings/" />);
    expect(screen.queryByTestId('node-banner')).toBeNull();
  });

  test('throttled: the 429, the age of the numbers, the countdown and the way out', () => {
    const onDefault = vi.fn();
    render(
      <NodeBanner
        state={{ kind: 'throttled', ageS: 40, retryInS: 12 }}
        settingsHref="/mine/settings/"
        onDefault={onDefault}
      />,
    );
    const banner = screen.getByTestId('node-banner');
    expect(banner).toHaveAttribute('data-kind', 'throttled');
    expect(banner.textContent).toContain('rate-limiting this page (HTTP 429)');
    expect(banner.textContent).toContain('40 s old and counting');
    expect(banner.textContent).toContain('a claim sent now would fail');
    expect(screen.getByTestId('node-banner-retry').textContent).toBe('retrying in 12 s');
    expect(screen.getByTestId('node-settings-link')).toHaveAttribute('href', '/mine/settings/');
    screen.getByTestId('use-default-node').click();
    expect(onDefault).toHaveBeenCalled();
  });

  test('silent and stale read as the last numbers; minutes past ninety seconds; no countdown when none', () => {
    render(<NodeBanner state={{ kind: 'silent', ageS: 130, retryInS: 5 }} />);
    expect(screen.getByTestId('node-banner').textContent).toContain('has not answered for 2 min');
    cleanup();
    render(<NodeBanner state={{ kind: 'stale', ageS: 75, retryInS: null }} />);
    expect(screen.getByTestId('node-banner').textContent).toContain('no chain read has landed for 75 s');
    expect(screen.queryByTestId('node-banner-retry')).toBeNull();
    expect(screen.queryByTestId('use-default-node')).toBeNull();
  });

  test('before any read the age is said as such', () => {
    render(<NodeBanner state={{ kind: 'throttled', ageS: null, retryInS: 15 }} />);
    expect(screen.getByTestId('node-banner').textContent).toContain('numbers are not read yet');
  });
});
