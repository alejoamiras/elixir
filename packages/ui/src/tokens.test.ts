import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'vitest';
import { DARK } from './tokens.ts';

const src = dirname(fileURLToPath(import.meta.url));
const css = readFileSync(join(src, 'theme.css'), 'utf8');

describe('tokens', () => {
  test('tokens.ts equals the :root palette in theme.css', () => {
    const root = css.slice(css.indexOf(':root {'), css.indexOf('.light {'));
    const value = (name: string) => root.match(new RegExp(`--${name}: ([^;]+);`))?.[1];
    expect(value('ground')).toBe(DARK.ground);
    expect(value('raised')).toBe(DARK.raised);
    expect(value('panel')).toBe(DARK.panel);
    expect(value('ink')).toBe(DARK.ink);
    expect(value('uv')).toBe(DARK.uv);
    expect(value('uv-2')).toBe(DARK.uv2);
    expect(value('ok')).toBe(DARK.ok);
    expect(value('warn')).toBe(DARK.warn);
    expect(value('bad')).toBe(DARK.bad);
  });

  test('components carry no literal colours', () => {
    const dir = join(src, 'components');
    const literal = /#[0-9a-f]{3,8}\b|\b(rgba?|hsla?|oklch)\(/i;
    const offenders = readdirSync(dir)
      .filter((f) => f.endsWith('.tsx') && !f.includes('.vitest.'))
      .filter((f) => literal.test(readFileSync(join(dir, f), 'utf8')));
    expect(offenders).toEqual([]);
  });
});
