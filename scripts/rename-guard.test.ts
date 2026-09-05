// The protocol was renamed from Elixir to Yacana; nothing active may still carry the old name.
// History is exempt (plans, the pitch, the archived deployment record and its docs section), and
// so is bun.lock, whose integrity hashes contain arbitrary substrings.
import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { $ } from 'bun';

const repo = resolve(import.meta.dir, '..');
// Binary fixtures are skipped by content; everything else tracked is scanned, path included.
const BINARY = /\/fixtures\/[^/]+\/(proof|public_inputs|vk|vk_hash)$/;
const EXEMPT_PATHS = [
  /^implementations-plan\//,
  /^docs\/pitch\//,
  /^deployments\/elixir-testnet-/,
  /^bun\.lock$/,
  /^scripts\/rename-guard\.test\.ts$/,
];
// Paths that legitimately keep the old name may be referenced from live files.
const EXEMPT_REFERENCES = [/implementations-plan\/elixir-[\w-]*/g, /deployments\/elixir-testnet-[\w.-]*/g];
// Any spelling inside identifiers too (ElixirMiner, VITE_ELIXIR_MINER, deployElixir, elixir_work);
// the symbol is bounded by non-alphanumerics so it cannot match inside a longer token.
const OLD_NAME = /elixir|(^|[^a-z0-9])t?ELX([^a-z0-9]|$)/i;

const tracked = (await $`git ls-files`.cwd(repo).text()).split('\n').filter(Boolean);

const offending = (file: string, text: string): string[] => {
  const lines = text.split('\n');
  // docs/deployments.md keeps the old deployment under an "Archived" heading, up to the next heading.
  const start = file === 'docs/deployments.md' ? lines.findIndex((l) => l.startsWith('## Archived')) : -1;
  const end = start === -1 ? -1 : lines.findIndex((l, i) => i > start && l.startsWith('## '));
  return lines
    .map((line, i) => ({ line: EXEMPT_REFERENCES.reduce((l, re) => l.replace(re, ''), line), i }))
    .filter(({ i }) => start === -1 || i < start || (end !== -1 && i >= end))
    .filter(({ line }) => OLD_NAME.test(line))
    .map(({ i }) => `${file}:${i + 1}`);
};

describe('rename guard', () => {
  test('no active file names the old protocol', () => {
    const live = tracked.filter((f) => !EXEMPT_PATHS.some((re) => re.test(f)));
    const hits = [
      ...live.filter((f) => OLD_NAME.test(f)).map((f) => `${f} (path)`),
      ...live
        .filter((f) => !BINARY.test(f))
        .flatMap((f) => offending(f, readFileSync(resolve(repo, f), 'utf8'))),
    ];
    expect(hits).toEqual([]);
  });

  test('the pattern catches identifier spellings', () => {
    for (const s of [
      'ElixirMiner',
      'VITE_ELIXIR_MINER',
      'deployElixir',
      'elixir_work.json',
      '4 tELX',
      'ELX/depl',
    ])
      expect(OLD_NAME.test(s)).toBe(true);
    for (const s of ['sha256:9ELXq', 'PIXELXY', 'yacana_work']) expect(OLD_NAME.test(s)).toBe(false);
  });

  test('workspace packages are scoped @yacana', () => {
    const names = tracked
      .filter((f) => /^(packages\/[^/]+\/)?package\.json$/.test(f))
      .map((f) => (JSON.parse(readFileSync(resolve(repo, f), 'utf8')) as { name: string }).name);
    expect(names).toContain('yacana');
    for (const n of names) expect(n === 'yacana' || n.startsWith('@yacana/')).toBe(true);
  });
});
