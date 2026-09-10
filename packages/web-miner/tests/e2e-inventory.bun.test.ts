import { describe, expect, test } from 'bun:test';
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { INVENTORY, SPEC_FILES } from '../e2e/proof-inventory.ts';

const e2e = resolve(import.meta.dir, '../e2e');
const onDisk = readdirSync(e2e)
  .filter((f) => f.endsWith('.e2e.ts'))
  .sort();
const source = (f: string) => readFileSync(resolve(e2e, f), 'utf8');

/** Top-level `test('…'` titles in a spec, the way Playwright will report them. */
const titlesIn = (f: string): string[] =>
  [...source(f).matchAll(/^test\(\s*(['"`])((?:\\.|(?!\1).)*)\1/gm)].map((m) => m[2] as string);

describe('the shard lists and the inventory follow the spec files', () => {
  const shards = JSON.parse(readFileSync(resolve(e2e, 'shards.json'), 'utf8')) as Record<string, string[]>;

  test('every spec file is in exactly one shard, and no shard names a file that is not there', () => {
    const listed = Object.values(shards).flat();
    expect([...listed].sort()).toEqual(onDisk);
    expect(new Set(listed).size).toBe(listed.length);
    for (const files of Object.values(shards)) expect(files.length).toBeGreaterThan(0);
  });

  test('the inventory names every spec file and exactly the titles its source declares', () => {
    expect([...SPEC_FILES].sort()).toEqual(onDisk);
    for (const f of onDisk) expect(Object.keys(INVENTORY[f] ?? {}).sort(), f).toEqual(titlesIn(f).sort());
  });

  test('no spec is narrowed with .only', () => {
    for (const f of onDisk) expect(source(f), f).not.toMatch(/\b(test|describe)\.only\(/);
  });
});
