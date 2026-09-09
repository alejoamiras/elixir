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

/** `url` with `?epoch=` set or removed; everything else (`?from=`, the node pin) kept. */
export const withEpoch = (url: URL, epoch: number | null): URL => {
  const u = new URL(url);
  if (epoch === null) u.searchParams.delete('epoch');
  else u.searchParams.set('epoch', String(epoch));
  return u;
};

export const select = (epoch: number | null): void => {
  history.replaceState(null, '', withEpoch(new URL(location.href), epoch));
  window.dispatchEvent(new Event(CHANGED));
};

/** The window's first epoch lives in `?from=N`; absent (or not an epoch) is the newest window. */
export const fromSearch = (search: string): number | null => {
  const v = new URLSearchParams(search).get('from');
  if (v === null) return null;
  const n = Number(v);
  return Number.isInteger(n) && n >= 0 ? n : null;
};

/** `url` with `?from=` set or removed; `?epoch=` and the node pin kept. */
export const withFrom = (url: URL, from: number | null): URL => {
  const u = new URL(url);
  if (from === null) u.searchParams.delete('from');
  else u.searchParams.set('from', String(from));
  return u;
};

export const setFrom = (from: number | null): void => {
  history.replaceState(null, '', withFrom(new URL(location.href), from));
  window.dispatchEvent(new Event(CHANGED));
};

export const useFrom = (): number | null =>
  React.useSyncExternalStore(
    subscribe,
    () => fromSearch(location.search),
    () => null,
  );

export const useSelected = (): number | null =>
  React.useSyncExternalStore(
    subscribe,
    () => selectedFromSearch(location.search),
    () => null,
  );
