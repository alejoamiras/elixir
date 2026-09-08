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
const COPY_ROOTS = [
  'packages/web-miner/src',
  'packages/web-stats/src',
  'packages/miner-core/src/claim-failure.ts',
];
const COPY_EXEMPT_FILES = [
  /\.test\.tsx?$/,
  /\.vitest\.tsx$/,
  /\/keys\/passkey\.ts$/, // WebAuthn's literal 'public-key'
  /\/shims\//,
];
/** Compounds where "key" is the cryptographic object, not the account. */
const KEY_COMPOUNDS =
  /\b(passkeys?|proving keys?|verifier key|device key|admin key|spend key|public-key|secret key|signing key|private key|key material|api key)\b/gi;
/** The word on its own; `yacana-keys`, `yacana-key:` and `public-key` are joined tokens, not the word. */
const ACCOUNT_KEY = /(?<![\w:-])keys?(?![\w:-])/i;
/**
 * A file's copy: JSX text between tags (across lines, `.tsx` only: in a `.ts` file angle brackets are generics)
 * and string literals; imports, paths, test ids, comments and code identifiers are not copy. The boot phase
 * named 'key' (the sign-in screen's state) is an identifier.
 */
const copyOf = (source: string, jsx = true): { text: string; line: number }[] => {
  const out: { text: string; line: number }[] = [];
  const lineAt = (offset: number) => source.slice(0, offset).split('\n').length;
  // JSX text: between a closing `>` and the next `<`, spanning lines. Generics and arrows also put text
  // between angle brackets, so a span with code punctuation or no letters is not copy.
  for (const m of jsx ? source.matchAll(/>([^<>{}]+)</g) : []) {
    const text = (m[1] ?? '').trim();
    if (!text || /[;=()`]|=>/.test(text) || !/[a-z]{3,}/i.test(text)) continue;
    out.push({ text, line: lineAt((m.index ?? 0) + 1 + (m[1]?.search(/\S/) ?? 0)) });
  }
  const code = source
    .split('\n')
    .map((line) => (/^\s*(import|export|\/\/|\/?\*)/.test(line) || /from '|require\(/.test(line) ? '' : line))
    .join('\n')
    // A test id is an identifier, not copy; the rest of its line is still scanned.
    .replace(/data-testid="[^"]*"/g, '')
    .replace(/data-testid=\{[^}]*\}/g, '');
  for (const m of code.matchAll(/(['"`])((?:\\.|(?!\1).)*)\1/g)) {
    const text = m[2] ?? '';
    if (text && text !== 'key') out.push({ text, line: lineAt(m.index ?? 0) });
  }
  return out;
};

describe('account, not key', () => {
  test('no user-facing copy in the miner calls the account a key', () => {
    const files = tracked.filter(
      (f) => COPY_ROOTS.some((r) => f.startsWith(r)) && !COPY_EXEMPT_FILES.some((re) => re.test(f)),
    );
    const hits = files.flatMap((f) =>
      copyOf(readFileSync(resolve(repo, f), 'utf8'), f.endsWith('.tsx'))
        .filter(({ text }) => ACCOUNT_KEY.test(text.replace(KEY_COMPOUNDS, '')))
        .map(({ line }) => `${f}:${line}`),
    );
    expect(hits).toEqual([]);
  });

  test('the copy scanner sees sentences, not identifiers, and lets the compounds through', () => {
    const texts = (src: string) => copyOf(src).map((c) => c.text);
    expect(texts('<p>Your key is derived from the passkey.</p>')).toContain(
      'Your key is derived from the passkey.',
    );
    expect(texts('<p>\n  Your key is\n  ready.\n</p>')).toContain('Your key is\n  ready.');
    expect(texts('<p data-testid="greeting">Your key is ready.</p>')).toContain('Your key is ready.');
    expect(texts("throw new Error('no open key')")).toContain('no open key');
    expect(texts("import { keysAllowed } from './keys/allowed';")).toEqual([]);
    expect(texts('<div data-testid="key-screen">')).toEqual([]);
    expect(texts('const key = record.key;')).toEqual([]);
    expect(texts("if (boot.phase !== 'key') return null;")).toEqual([]);
    expect(texts('  /** "I already have a key": a discoverable request. */')).toEqual([]);
    // The persistent and protocol strings live in exempt files; the guard must never flag them anywhere.
    // Hyphen- or colon-joined tokens are identifiers, not the word "key": the persistent and protocol strings
    // (the vault's DB name and AAD prefix, WebAuthn's credential type) are never flagged, exempt file or not.
    for (const literal of ["'yacana-keys'", '`yacana-key:$' + '{r.v}`', "'public-key'"])
      expect(texts(`const x = ${literal};`).some((t) => ACCOUNT_KEY.test(t.replace(KEY_COMPOUNDS, '')))).toBe(
        false,
      );
    expect(ACCOUNT_KEY.test('Sign up with a passkey.'.replace(KEY_COMPOUNDS, ''))).toBe(false);
    expect(ACCOUNT_KEY.test('20 MB of proving keys'.replace(KEY_COMPOUNDS, ''))).toBe(false);
    expect(ACCOUNT_KEY.test('the account is sealed under a device key'.replace(KEY_COMPOUNDS, ''))).toBe(
      false,
    );
  });
});
