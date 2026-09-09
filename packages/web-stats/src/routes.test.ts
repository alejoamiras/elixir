import { describe, expect, test } from 'vitest';
import { fromSearch, selectedFromSearch, withEpoch, withFrom } from './routes';
import { centredFrom, newerFrom, olderFrom, WINDOW, windowFor } from './window';

describe('the window in the URL', () => {
  test('?from= names the window, absent or malformed means the newest; ?epoch= rides beside it', () => {
    expect(fromSearch('')).toBeNull();
    expect(fromSearch('?from=96')).toBe(96);
    expect(fromSearch('?from=-1')).toBeNull();
    expect(fromSearch('?from=abc')).toBeNull();
    expect(fromSearch('?from=1.5')).toBeNull();
    const both = '?epoch=7&from=3&node=https%3A%2F%2Fn.test';
    expect(fromSearch(both)).toBe(3);
    expect(selectedFromSearch(both)).toBe(7);
  });

  test('writing one keeps the other and the node pin', () => {
    const url = new URL('https://yacana.test/stats?node=https%3A%2F%2Fn.test&epoch=7');
    const withWindow = withFrom(url, 3);
    expect(withWindow.searchParams.get('from')).toBe('3');
    expect(withWindow.searchParams.get('epoch')).toBe('7');
    expect(withWindow.searchParams.get('node')).toBe('https://n.test');
    const followed = withFrom(withWindow, null);
    expect(followed.searchParams.has('from')).toBe(false);
    expect(followed.searchParams.get('epoch')).toBe('7');
    const reselected = withEpoch(withWindow, null);
    expect(reselected.searchParams.has('epoch')).toBe(false);
    expect(reselected.searchParams.get('from')).toBe('3');
  });
});

describe('the window over the chain', () => {
  test('clamps to both ends: the newest window when absent, never past epoch 0, never over the open epoch', () => {
    expect(windowFor(null, 999)).toEqual({ from: 952, to: 999 });
    expect(windowFor(null, 30)).toEqual({ from: 0, to: 30 });
    expect(windowFor(0, 30)).toEqual({ from: 0, to: 30 });
    expect(windowFor(-5, 999)).toEqual({ from: 0, to: 47 });
    expect(windowFor(980, 999)).toEqual({ from: 952, to: 999 });
    expect(windowFor(100, 999)).toEqual({ from: 100, to: 147 });
    expect(windowFor(null, 0)).toEqual({ from: 0, to: 0 });
  });

  test('pages by 48 and writes null once it is the newest window again', () => {
    const w = windowFor(100, 999);
    expect(olderFrom(w, 999)).toBe(52);
    expect(newerFrom(w, 999)).toBe(148);
    expect(olderFrom(windowFor(20, 999), 999)).toBe(0);
    expect(olderFrom(windowFor(0, 999), 999)).toBe(0);
    expect(newerFrom(windowFor(920, 999), 999)).toBeNull();
    expect(newerFrom(windowFor(null, 999), 999)).toBeNull();
    expect(centredFrom(500, 999)).toBe(500 - WINDOW / 2);
    expect(centredFrom(10, 999)).toBe(0);
    expect(centredFrom(990, 999)).toBeNull();
  });
});
