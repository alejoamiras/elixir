import { describe, expect, test } from 'bun:test';
import { PACKAGE } from './index.ts';

describe('miner-core', () => {
  test('placeholder until proof.ts lands', () => {
    expect(PACKAGE).toBe('@elixir/miner-core');
  });
});
