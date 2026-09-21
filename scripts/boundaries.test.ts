// A workspace is reached by its package name and through its `exports`, never by a path, and what a
// file imports its workspace declares. A path into another workspace compiles, tests and bundles
// exactly like a package import until the folder moves, so nothing but this notices one.
import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  isProduction,
  isRelative,
  ownerOf,
  reach,
  readManifest,
  repo,
  resolveRelative,
  SCRIPT,
  scriptSpecifiers,
  specifiersOf,
  tracked,
  workspaces,
} from './workspace-graph.ts';

// importer → target, each with why a path is right there.
const PATH_EDGES: Record<string, string> = {
  // Vite bundles a config and hands every bare specifier to the ambient Node, which nothing pins to
  // a version that strips types: what a config loads at build time is reached by path.
  'packages/web-landing/vite.config.ts → packages/site/src/vite-base.ts': 'config time',
  'packages/web-miner/vite.config.ts → packages/site/src/vite-base.ts': 'config time',
  'packages/web-stats/vite.config.ts → packages/site/src/vite-base.ts': 'config time',
  'packages/site/src/vite-base.ts → packages/ui/src/mark.ts': 'config time',
  // `/// <reference path>` takes a path, and the ambient types have no package of their own yet.
  'packages/web-landing/src/vite-env.d.ts → packages/site/src/browser/vite-env.d.ts': 'reference',
  'packages/web-miner/src/vite-env.d.ts → packages/site/src/browser/vite-env.d.ts': 'reference',
  'packages/web-stats/src/vite-env.d.ts → packages/site/src/browser/vite-env.d.ts': 'reference',
};
// Targets no workspace owns that a workspace may still reach by path.
const UNOWNED = [
  /^yacana\.params\.json$/,
  /^toolchain\.lock\.json$/,
  /^deployments\//,
  // Run isolation is not a workspace; its importers are tests, e2e setups and scripts.
  /^scripts\/run\//,
  // Two files the SDK does not export, read by one test of the wallet's store.
  /^node_modules\/@aztec\//,
];

const files = await tracked();
const all = workspaces(files);
const scanned = files.filter((f) => SCRIPT.test(f) || f.endsWith('.css'));
const lineOf = (source: string, offset: number): number => source.slice(0, offset).split('\n').length;

interface Found {
  file: string;
  line: number;
  text: string;
  target?: string;
}
const relative: Found[] = [];
const packaged: Found[] = [];
for (const file of scanned) {
  // One-off tools that belong to no workspace, neither shipped nor run in CI; and this file's own fixtures.
  if (file.startsWith('implementations-plan/') || file === 'scripts/boundaries.test.ts') continue;
  const source = readFileSync(join(repo, file), 'utf8');
  for (const s of specifiersOf(file, source)) {
    const found = { file, line: lineOf(source, s.start), text: s.text };
    // A file that is not there, or a glob, still reaches a folder: the boundary is judged by that.
    if (isRelative(s.text))
      relative.push({ ...found, target: resolveRelative(file, s.text) ?? reach(file, s.text) });
    else if (s.text.startsWith('@yacana/')) packaged.push(found);
  }
}

/** Why this import is not properly declared, or undefined. Files no workspace owns answer to the root manifest. */
function undeclared(p: Found): string | undefined {
  const name = p.text.split('/').slice(0, 2).join('/');
  const from = ownerOf(p.file, all);
  if (from?.name === name) return undefined;
  const manifest = from?.manifest ?? readManifest('.');
  const where = from ? `${from.dir}/package.json` : 'package.json';
  const production = from !== undefined && isProduction(p.file);
  const declared =
    manifest.dependencies?.[name] ?? (production ? undefined : manifest.devDependencies?.[name]);
  if (declared) return undefined;
  return `${p.file}:${p.line} imports ${name}: not in ${production ? 'dependencies' : 'any block'} of ${where}`;
}

describe('workspace boundaries', () => {
  test('no path leaves its workspace', () => {
    const offenders = relative
      .filter((r) => {
        if (!r.target) return false;
        if (r.target.startsWith('..')) return true;
        const from = ownerOf(r.file, all);
        const to = ownerOf(r.target, all);
        if (to === from) return false;
        if (!to) return from !== undefined && !UNOWNED.some((u) => u.test(r.target ?? ''));
        return !(`${r.file} → ${r.target}` in PATH_EDGES);
      })
      .map((r) => `${r.file}:${r.line} reaches ${r.target} by path (${r.text})`);
    expect(offenders).toEqual([]);
  });

  test('every listed exception still exists', () => {
    const live = new Set(relative.map((r) => `${r.file} → ${r.target}`));
    expect(Object.keys(PATH_EDGES).filter((e) => !live.has(e))).toEqual([]);
  });

  test('a workspace import is declared, under dependencies when production code imports it', () => {
    // A listed path edge is a dependency like any other; only its spelling is excused.
    const byPath = relative.flatMap((r) => {
      const owner = `${r.file} → ${r.target}` in PATH_EDGES ? ownerOf(r.target ?? '', all) : undefined;
      return owner ? [{ ...r, text: owner.name }] : [];
    });
    expect([...packaged, ...byPath].map(undeclared).filter(Boolean)).toEqual([]);
  });

  test('a workspace import names a subpath its owner exports', () => {
    const byName = new Map(all.map((w) => [w.name, w]));
    const offenders = packaged.flatMap((p) => {
      const [scope, pkg, ...rest] = p.text.replace(/[?#].*$/, '').split('/');
      const owner = byName.get(`${scope}/${pkg}`);
      const sub = rest.length ? `./${rest.join('/')}` : '.';
      if (!owner) return [`${p.file}:${p.line} imports ${p.text}: no such workspace`];
      return owner.manifest.exports?.[sub]
        ? []
        : [`${p.file}:${p.line} imports ${p.text}: ${owner.name} does not export ${sub}`];
    });
    expect(offenders).toEqual([]);
  });
});

describe('the specifier extractor', () => {
  test('sees every form of import and reference, and nothing in a comment or a string', () => {
    const source = [
      '/// <reference path="../x/env.d.ts" />',
      "// import { no } from './comment.ts';",
      "import a from './a.ts';",
      'import type { B } from "./b.ts";',
      "export * from './c.ts';",
      "export type { D } from './d.ts';",
      'const s = "import(\'./string.ts\')";',
      "const e = await import('./e.json?raw');",
      "type F = typeof import('./f.ts');",
      "let g: import('./g.ts').G;",
      'import {',
      '  h,',
      "} from './h.ts';",
      "import './side.css';",
    ].join('\n');
    const found = scriptSpecifiers(source);
    expect(found.map((s) => s.text)).toEqual([
      '../x/env.d.ts',
      './a.ts',
      './b.ts',
      './c.ts',
      './d.ts',
      './e.json?raw',
      './f.ts',
      './g.ts',
      './h.ts',
      './side.css',
    ]);
    // The offsets are what the codemod writes through.
    for (const s of found) expect(source.slice(s.start, s.end)).toBe(s.text);
  });

  test('sees the paths a bundler or a test runner follows though the compiler does not', () => {
    const source = [
      "import.meta.glob('../../x/src/*.ts');",
      "new Worker(new URL('../../x/src/w.ts', import.meta.url));",
      "vi.mock('../../x/src/m.ts');",
      "mock.module('../../x/src/n.ts', () => ({}));",
      "new URL('https://example.org');",
      'import.meta.glob(["../../x/src/a/*.ts", `../../x/src/b/*.ts`]);',
      'new Worker(new URL ("../../x/src/spaced.ts", import.meta.url));',
      'export const identity = <T>(x: T) => x;',
      "new URL('../../x/src/after-generic.ts', import.meta.url);",
    ].join('\n');
    expect(specifiersOf('a.ts', source).map((s) => s.text)).toEqual([
      '../../x/src/*.ts',
      '../../x/src/w.ts',
      '../../x/src/m.ts',
      '../../x/src/n.ts',
      '../../x/src/a/*.ts',
      '../../x/src/b/*.ts',
      '../../x/src/spaced.ts',
      '../../x/src/after-generic.ts',
    ]);
  });

  test('sees a CSS @import and leaves @source alone', () => {
    const css = '@import "../../ui/src/theme.css";\n@source "../../ui/src";\n@import url("./b.css");';
    expect(specifiersOf('x.css', css).map((s) => s.text)).toEqual(['../../ui/src/theme.css', './b.css']);
  });
});
