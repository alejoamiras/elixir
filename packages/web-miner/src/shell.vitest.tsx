import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { queryOverridesAllowed } from './config';
import { isDesktop } from './desktop';
import { aliasRedirect, hostKind, keysAllowed } from './host';
import { navigate, pathFor, routeFromPath, useRoute } from './routes';
import { tabTitle } from './tab-status';

afterEach(() => {
  history.replaceState(null, '', '/');
  vi.unstubAllEnvs();
});

describe('routes', () => {
  test('three routes under the base; anything else is the cockpit', () => {
    expect(routeFromPath('/')).toBe('mine');
    expect(routeFromPath('/wallet')).toBe('wallet');
    expect(routeFromPath('/settings/')).toBe('settings');
    expect(routeFromPath('/nonsense')).toBe('mine');
    expect(pathFor('mine')).toBe('/');
    expect(pathFor('wallet')).toBe('/wallet');
  });

  test('useRoute follows navigate() and popstate', () => {
    const { result } = renderHook(() => useRoute());
    expect(result.current).toBe('mine');
    act(() => navigate('wallet'));
    expect(result.current).toBe('wallet');
    expect(location.pathname).toBe('/wallet');
    act(() => {
      history.replaceState(null, '', '/settings');
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
    expect(result.current).toBe('settings');
  });
});

describe('desktop-only', () => {
  const win = (innerWidth: number, coarse: boolean) => ({
    innerWidth,
    matchMedia: (q: string) => ({ matches: q.includes('coarse') && coarse }) as MediaQueryList,
  });
  test('narrow layouts and coarse pointers without threads are not desktops', () => {
    expect(isDesktop(win(1280, false), true)).toBe(true);
    expect(isDesktop(win(899, false), true)).toBe(false);
    expect(isDesktop(win(1280, true), false)).toBe(false);
    expect(isDesktop(win(1280, true), true)).toBe(true);
  });
});

describe('query overrides', () => {
  test('need the e2e build flag and localhost', () => {
    vi.stubEnv('VITE_E2E_QUERY_OVERRIDES', '1');
    expect(queryOverridesAllowed('localhost')).toBe(true);
    expect(queryOverridesAllowed('yacana.network')).toBe(false);
    vi.stubEnv('VITE_E2E_QUERY_OVERRIDES', '');
    expect(queryOverridesAllowed('localhost')).toBe(false);
  });
});

describe('host rules', () => {
  test('production, alias, preview, local', () => {
    vi.stubEnv('VITE_RP_ID', 'yacana.network');
    vi.stubEnv('VITE_SITE_MODE', 'e2e');
    expect(hostKind('yacana.network')).toBe('production');
    expect(hostKind('yacana.pages.dev')).toBe('alias');
    expect(hostKind('abc123.yacana.pages.dev')).toBe('preview');
    expect(hostKind('localhost')).toBe('local');
    expect(hostKind('evil.example')).toBe('unknown');
    expect(
      aliasRedirect({ hostname: 'yacana.pages.dev', pathname: '/mine/wallet', search: '?a=1', hash: '' }),
    ).toBe('https://yacana.network/mine/wallet?a=1');
    expect(aliasRedirect({ hostname: 'yacana.network', pathname: '/', search: '', hash: '' })).toBeNull();
    expect(keysAllowed('yacana.network')).toBe(true);
    expect(keysAllowed('abc123.yacana.pages.dev')).toBe(false);
    expect(keysAllowed('localhost')).toBe(true);
    vi.stubEnv('VITE_SITE_MODE', 'production');
    expect(keysAllowed('localhost')).toBe(false);
  });
});

describe('tab title', () => {
  test('mirrors the pill: marker · rate · claims · Yacana', () => {
    expect(tabTitle({ mark: 'mining', rate: '18/min', claims: '2/4' })).toBe('▸ · 18/min · 2/4 · Yacana');
    expect(tabTitle({ mark: 'idle', claims: '2/4' })).toBe('2/4 · Yacana');
    expect(tabTitle({ mark: 'paused' })).toBe('‖ · Yacana');
  });
});
