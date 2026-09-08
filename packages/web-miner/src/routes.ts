import * as React from 'react';

export type Route = 'mine' | 'wallet' | 'settings';

const base = (import.meta.env.BASE_URL ?? '/').replace(/\/$/, '');

/** `/mine`, `/mine/wallet`, `/mine/settings` under the app's base; anything else is the cockpit. */
export const routeFromPath = (pathname: string): Route => {
  const rest = pathname.startsWith(base) ? pathname.slice(base.length) : pathname;
  const first = rest.split('/').filter(Boolean)[0];
  return first === 'wallet' || first === 'settings' ? first : 'mine';
};

export const pathFor = (route: Route): string => `${base}/${route === 'mine' ? '' : route}`;

const NAVIGATE = 'yacana:navigate';

/** `intent` rides in history state: `send` opens the wallet's Send sheet on arrival. */
export const navigate = (route: Route, intent?: 'send'): void => {
  history.pushState(intent ? { intent } : null, '', pathFor(route));
  window.dispatchEvent(new Event(NAVIGATE));
};

/** Reads and clears a navigation intent, so a reload or a back does not reopen the sheet. */
export const takeIntent = (): 'send' | undefined => {
  const intent = (history.state as { intent?: 'send' } | null)?.intent;
  if (intent) history.replaceState(null, '', location.href);
  return intent;
};

const subscribe = (cb: () => void) => {
  window.addEventListener('popstate', cb);
  window.addEventListener(NAVIGATE, cb);
  return () => {
    window.removeEventListener('popstate', cb);
    window.removeEventListener(NAVIGATE, cb);
  };
};

export const useRoute = (): Route =>
  React.useSyncExternalStore(
    subscribe,
    () => routeFromPath(location.pathname),
    () => 'mine',
  );
