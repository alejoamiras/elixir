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

export const navigate = (route: Route): void => {
  history.pushState(null, '', pathFor(route));
  window.dispatchEvent(new Event(NAVIGATE));
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
