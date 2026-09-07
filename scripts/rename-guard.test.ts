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
// Paths that legitimately keep the old name may be referenced from live files, as may the two
// external names that predate the rename: the GitHub repository and the retired Pages project.
const EXEMPT_REFERENCES = [
  /implementations-plan\/elixir-[\w-]*/g,
  /deployments\/elixir-testnet-[\w.-]*/g,
  /github\.com\/alejoamiras\/elixir/g,
  /elixir-web-miner\.pages\.dev/g,
];
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

// The person's account is an "account" in every sentence the miner shows; "key" is for cryptography.
// Only copy is scanned (JSX text and the string literals of user-facing messages); persistent and
// protocol strings must never change, since renaming them would strand accounts or break sign-in.
const COPY_ROOTS = ['packages/web-miner/src', 'packages/miner-core/src/claim-failure.ts'];
const COPY_EXEMPT_FILES = [
  /\.test\.tsx?$/,
  /\.vitest\.tsx$/,
  /\/keys\/store\.ts$/, // DB_NAME 'yacana-keys', the AAD prefix 'yacana-key:', the vault's own invariants
  /\/keys\/passkey\.ts$/, // WebAuthn's literal 'public-key'
  /\/shims\//,
];
/** Compounds where "key" is the cryptographic object, not the account. */
const KEY_COMPOUNDS =
  /\b(passkeys?|proving keys?|verifier key|device key|admin key|spend key|public-key|secret key|signing key|private key|key material|api key)\b/gi;
const ACCOUNT_KEY = /\bkeys?\b/i;
/**
 * A line's copy: JSX text between tags, and string literals; imports, paths, test ids, comments and code
 * identifiers are not copy. The boot phase named 'key' (the sign-in screen's state) is an identifier.
 */
const copyOf = (line: string): string => {
  if (/^\s*(import|export|\/\/|\/?\*)/.test(line) || /data-testid=|from '|require\(/.test(line)) return '';
  const strings = [...line.matchAll(/(['"`])((?:\\.|(?!\1).)*)\1/g)]
    .map((m) => m[2] ?? '')
    .filter((str) => !/^key$/.test(str));
  const jsx = [...line.matchAll(/>([^<>{}]+)</g)].map((m) => m[1] ?? '');
  return [...strings, ...jsx].join(' ');
};

describe('account, not key', () => {
  test('no user-facing copy in the miner calls the account a key', () => {
    const files = tracked.filter(
      (f) => COPY_ROOTS.some((r) => f.startsWith(r)) && !COPY_EXEMPT_FILES.some((re) => re.test(f)),
    );
    const hits = files.flatMap((f) =>
      readFileSync(resolve(repo, f), 'utf8')
        .split('\n')
        .map((line, i) => ({ text: copyOf(line).replace(KEY_COMPOUNDS, ''), i }))
        .filter(({ text }) => ACCOUNT_KEY.test(text))
        .map(({ i }) => `${f}:${i + 1}`),
    );
    expect(hits).toEqual([]);
  });

  test('the copy scanner sees sentences, not identifiers, and lets the compounds through', () => {
    expect(copyOf('<p>Your key is derived from the passkey.</p>')).toContain('Your key');
    expect(copyOf("throw new Error('no open key')")).toContain('no open key');
    expect(copyOf("import { keysAllowed } from './keys/allowed';")).toBe('');
    expect(copyOf('<div data-testid="key-screen">')).toBe('');
    expect(copyOf('const key = record.key;')).toBe('');
    expect(copyOf("if (boot.phase !== 'key') return null;")).toBe('');
    expect(copyOf('  /** "I already have a key": a discoverable request. */')).toBe('');
    expect(ACCOUNT_KEY.test('Sign up with a passkey.'.replace(KEY_COMPOUNDS, ''))).toBe(false);
    expect(ACCOUNT_KEY.test('20 MB of proving keys'.replace(KEY_COMPOUNDS, ''))).toBe(false);
    expect(ACCOUNT_KEY.test('the account is sealed under a device key'.replace(KEY_COMPOUNDS, ''))).toBe(
      false,
    );
  });
});
