import { describe, expect, test } from 'vitest';
import { DEFAULTS, parseSettings } from './settings';

describe('settings', () => {
  test('defaults, partial values, foreign values', () => {
    expect(parseSettings(null)).toEqual(DEFAULTS);
    expect(parseSettings('not json')).toEqual(DEFAULTS);
    expect(parseSettings('[1]')).toEqual(DEFAULTS);
    expect(parseSettings(JSON.stringify({ threads: 6, theme: 'light', notify: true }))).toEqual({
      ...DEFAULTS,
      threads: 6,
      theme: 'light',
      notify: true,
    });
    expect(parseSettings(JSON.stringify({ threads: 0.5, theme: 'neon', notify: 'yes' }))).toEqual(DEFAULTS);
  });

  test('round-trips through JSON', () => {
    const s = { ...DEFAULTS, threads: 3, pip: true, theme: 'system' as const };
    expect(parseSettings(JSON.stringify(s))).toEqual(s);
  });
});
