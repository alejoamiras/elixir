// The protocol was renamed from Elixir to Yacana; nothing active may still carry the old name.
// History is exempt (plans, the pitch, the archived deployment record and its docs section), and
// so is bun.lock, whose integrity hashes contain arbitrary substrings.
import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { $ } from 'bun';

const repo = resolve(import.meta.dir, '..');
const EXTENSIONS = /\.(ts|tsx|nr|toml|json|jsonc|yml|md|html)$/;
const EXEMPT_PATHS = [
  /^implementations-plan\//,
  /^docs\/pitch\//,
  /^deployments\/elixir-testnet-/,
  /^bun\.lock$/,
];
// Paths that legitimately keep the old name may be referenced from live files.
const EXEMPT_REFERENCES = [/implementations-plan\/elixir-[\w-]*/g, /deployments\/elixir-testnet-[\w.-]*/g];
const OLD_NAME = /\b(elixir|Elixir|ELIXIR|ELX|tELX)\b/;

const tracked = (await $`git ls-files`.cwd(repo).text()).split('\n').filter((f) => EXTENSIONS.test(f));

const offending = (file: string, text: string): string[] => {
  const lines = text.split('\n');
  // docs/deployments.md keeps the old deployment under an "Archived" heading; everything from there on is history.
  const end = file === 'docs/deployments.md' ? lines.findIndex((l) => l.startsWith('## Archived')) : -1;
  return lines
    .slice(0, end === -1 ? lines.length : end)
    .map((line, i) => ({ line: EXEMPT_REFERENCES.reduce((l, re) => l.replace(re, ''), line), i }))
    .filter(({ line }) => OLD_NAME.test(line))
    .map(({ i }) => `${file}:${i + 1}`);
};

describe('rename guard', () => {
  test('no active file names the old protocol', () => {
    const hits = tracked
      .filter((f) => !EXEMPT_PATHS.some((re) => re.test(f)))
      .flatMap((f) => offending(f, readFileSync(resolve(repo, f), 'utf8')));
    expect(hits).toEqual([]);
  });

  test('workspace packages are scoped @yacana', () => {
    const names = tracked
      .filter((f) => /^(packages\/[^/]+\/)?package\.json$/.test(f))
      .map((f) => (JSON.parse(readFileSync(resolve(repo, f), 'utf8')) as { name: string }).name);
    expect(names).toContain('yacana');
    for (const n of names) expect(n === 'yacana' || n.startsWith('@yacana/')).toBe(true);
  });
});
