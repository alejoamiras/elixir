import { describe, expect, test } from 'bun:test';
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { INVENTORY, MOVED_TO_REPLAY, REPLAYED, SPEC_FILES } from '../e2e/proof-inventory.ts';

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

  test('the canary shard is the one CI runs with the real prover; its companions never prove', () => {
    expect(shards.canary).toContain('canary.e2e.ts');
    for (const f of shards.canary ?? [])
      if (f !== 'canary.e2e.ts')
        for (const floor of Object.values(INVENTORY[f] ?? {})) expect(floor, f).toBe(0);
  });

  test('the inventory names every spec file and exactly the titles its source declares', () => {
    expect([...SPEC_FILES].sort()).toEqual(onDisk);
    for (const f of onDisk) expect(Object.keys(INVENTORY[f] ?? {}).sort(), f).toEqual(titlesIn(f).sort());
  });

  test('titles are unique across files: the coverage check and the floors key on them', () => {
    const titles = Object.values(INVENTORY).flatMap((t) => Object.keys(t));
    expect(new Set(titles).size).toBe(titles.length);
  });

  test('no spec is narrowed with .only', () => {
    for (const f of [...onDisk, ...replayOnDisk.map((f) => `replay/${f}`)])
      expect(source(f), f).not.toMatch(/\b(test|describe)\.only\(/);
  });
});

const replayOnDisk = readdirSync(resolve(e2e, 'replay'))
  .filter((f) => f.endsWith('.replay.ts'))
  .sort();

describe('the replay lane took exactly the tests it was given', () => {
  test('its files and titles are the declared ones', () => {
    expect(Object.keys(REPLAYED).sort()).toEqual(replayOnDisk);
    for (const f of replayOnDisk)
      expect([...(REPLAYED[f] ?? [])].sort(), f).toEqual(titlesIn(`replay/${f}`).sort());
  });

  test('the sharded suite plus the moved tests are the original nineteen, the moved ones by name', () => {
    const sharded = Object.values(INVENTORY).flatMap((t) => Object.keys(t));
    const replayed = Object.values(REPLAYED).flat();
    for (const title of MOVED_TO_REPLAY) {
      expect(sharded, title).not.toContain(title);
      expect(replayed, title).toContain(title);
    }
    // Every original test is somewhere, exactly once; the canary is the one addition.
    expect(sharded.length + MOVED_TO_REPLAY.length).toBe(19 + 1);
    expect(new Set([...sharded, ...replayed]).size).toBe(sharded.length + replayed.length);
  });
});
