import type { HeaderTab } from '../../../ui/src/index.ts';
import { pathFor, type Route } from '../routes';
import { statsHref } from './apex';

/**
 * Mine · Wallet · Stats ↗ · Verify ↗: mining lives in this tab, so the read-only app opens in another.
 * `waiting` is how many rows in the Wallet need the user; the tab carries it as a badge.
 */
export const minerTabs = (
  route: Route,
  go: (route: Route) => void,
  stats = statsHref,
  waiting = 0,
): HeaderTab[] => [
  {
    label: 'Mine',
    icon: 'mine',
    href: pathFor('mine'),
    current: route === 'mine',
    onSelect: () => go('mine'),
  },
  {
    label: 'Wallet',
    icon: 'wallet',
    href: pathFor('wallet'),
    current: route === 'wallet',
    count: waiting,
    onSelect: () => go('wallet'),
  },
  { label: 'Stats', icon: 'stats', href: stats, external: true, testId: 'nav-stats' },
  { label: 'Verify', icon: 'verify', href: `${stats}verify`, external: true, testId: 'nav-verify' },
];

/** The old origin's two: Send ahead is its one page, Stats ↗ the apex's. No Wallet: the page is the wallet. */
export const oldTabs = (route: Route, go: (route: Route) => void, stats = statsHref): HeaderTab[] => [
  {
    label: 'Send ahead',
    icon: 'mine',
    href: pathFor('mine'),
    current: route === 'mine',
    onSelect: () => go('mine'),
  },
  { label: 'Stats', icon: 'stats', href: stats, external: true, testId: 'nav-stats' },
];
