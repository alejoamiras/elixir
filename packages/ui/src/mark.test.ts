import { describe, expect, test } from 'vitest';
import { faviconDataUrl, type MarkState, markSvg } from './mark.ts';
import { DARK } from './tokens.ts';

describe('faviconDataUrl', () => {
  test('is an SVG data URL per state, distinct across states', () => {
    const states: MarkState[] = ['idle', 'mining', 'won', 'paused'];
    const urls = states.map(faviconDataUrl);
    for (const u of urls) expect(u.startsWith('data:image/svg+xml,')).toBe(true);
    expect(new Set(urls).size).toBe(4);
  });

  test('the dot colour and height follow the state', () => {
    expect(markSvg('idle')).not.toContain(DARK.uv);
    expect(markSvg('mining')).toContain(`fill="${DARK.uv}"`);
    expect(markSvg('paused')).toContain(`fill="${DARK.bad}"`);
    expect(markSvg('mining')).toContain('cy="15"');
    expect(markSvg('won')).toContain('cy="8"');
  });
});
