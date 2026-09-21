import { useSetAtom } from 'jotai';
import { useCallback } from 'react';
import { logAtom } from '../state';

/**
 * A tile boundary's error goes to the diagnostics log, never the page. The message is already cut to
 * 300 chars by the boundary; the copy button (About) prints the node's host, never its URL.
 */
export function useTileLog(): (message: string) => void {
  const append = useSetAtom(logAtom);
  return useCallback(
    (message) =>
      append((l) => [...l.slice(-199), `${new Date().toISOString().slice(11, 19)} tile ${message}`]),
    [append],
  );
}
