import type { Launch, Live } from './live';

export type LiveStatus =
  | { phase: 'loading' }
  | { phase: 'error'; message: string }
  /** Launch mode before `launch()`: epoch 0 does not exist yet, there is nothing live to read. */
  | { phase: 'unlaunched' }
  /** `unreachable` after a poll fails: the numbers shown are `live`'s, the last read. */
  | { phase: 'ready'; live: Live; unreachable: boolean };

export type LaunchStatus = { phase: 'loading' } | { phase: 'ready'; launch: Launch } | { phase: 'error' };

export const launchMode = (): boolean => import.meta.env.VITE_LAUNCH_MODE === '1';

/** Hrefs of the other two apps, relative to this page's base (`/` alone or inside the origin). */
export const appHref = (app: 'mine' | 'stats'): string => `${import.meta.env.BASE_URL}${app}/`;
