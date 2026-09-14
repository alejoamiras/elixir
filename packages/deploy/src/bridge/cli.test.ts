import { describe, expect, test } from 'bun:test';
import { parseCliArgs } from './cli.ts';

const known = { '--from-archive': 'switch', '--batch': 'integer' } as const;

describe('the bridge CLI arguments', () => {
  test('positionals in order, a switch, an integer flag', () => {
    const { positional, flags } = parseCliArgs(
      ['--', 'forward', 'a.json', '--batch', '3', 'b.json', '--from-archive'],
      known,
    );
    expect(positional).toEqual(['forward', 'a.json', 'b.json']);
    expect(flags.get('--batch')).toBe(3);
    expect(flags.get('--from-archive')).toBe(true);
  });

  test('refuses what it does not understand instead of running with a default', () => {
    expect(() => parseCliArgs(['forward', '--batch'], known)).toThrow(/whole number/);
    expect(() => parseCliArgs(['forward', '--batch', 'x'], known)).toThrow(/whole number/);
    expect(() => parseCliArgs(['forward', '--batch=1'], known)).toThrow(/unknown flag --batch=1/);
    expect(() => parseCliArgs(['forward', '--quick'], known)).toThrow(/unknown flag --quick/);
    expect(() => parseCliArgs(['forward', '--from-archive', '--from-archive'], known)).toThrow(/twice/);
  });
});
