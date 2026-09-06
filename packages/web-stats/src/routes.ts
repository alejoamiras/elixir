import * as React from 'react';

export type Route = 'stats' | 'verify';

const base = (import.meta.env.BASE_URL ?? '/').replace(/\/$/, '');

/** `/stats` and `/stats/verify` under the app's base; anything else is the observatory. */
export const routeFromPath = (pathname: string): Route => {
  const rest = pathname.startsWith(base) ? pathname.slice(base.length) : pathname;
  return rest.split('/').filter(Boolean)[0] === 'verify' ? 'verify' : 'stats';
};

export const pathFor = (route: Route): string => `${base}/${route === 'stats' ? '' : route}`;

const CHANGED = 'yacana:navigate';

export const navigate = (route: Route): void => {
  history.pushState(null, '', pathFor(route));
  window.dispatchEvent(new Event(CHANGED));
};

const subscribe = (cb: () => void) => {
  window.addEventListener('popstate', cb);
  window.addEventListener(CHANGED, cb);
  return () => {
    window.removeEventListener('popstate', cb);
    window.removeEventListener(CHANGED, cb);
  };
};

export const useRoute = (): Route =>
  React.useSyncExternalStore(
    subscribe,
    () => routeFromPath(location.pathname),
    () => 'stats',
  );

/** The selected epoch lives in `?epoch=N`, so a view is a link; null selects the open epoch. */
export const selectedFromSearch = (search: string): number | null => {
  const v = new URLSearchParams(search).get('epoch');
  if (v === null) return null;
  const n = Number(v);
  return Number.isInteger(n) && n >= 0 ? n : null;
};

export const select = (epoch: number | null): void => {
  const url = new URL(location.href);
  if (epoch === null) url.searchParams.delete('epoch');
  else url.searchParams.set('epoch', String(epoch));
  history.replaceState(null, '', url);
  window.dispatchEvent(new Event(CHANGED));
};

export const useSelected = (): number | null =>
  React.useSyncExternalStore(
    subscribe,
    () => selectedFromSearch(location.search),
    () => null,
  );
