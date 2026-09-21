import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { $, Glob } from 'bun';
import ts from 'typescript';

export const repo = resolve(import.meta.dir, '..');

export interface Workspace {
  /** Package name, `@yacana/<x>`. */
  name: string;
  /** Folder relative to the repository root. */
  dir: string;
  manifest: Manifest;
}

export interface Manifest {
  name: string;
  main?: string;
  exports?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  workspaces?: string[];
}

export interface Specifier {
  /** As written, query suffix included. */
  text: string;
  /** Offsets of `text` in the file, quotes excluded. */
  start: number;
  end: number;
  kind: 'import' | 'reference' | 'css-import' | 'path-call';
}

export const readManifest = (dir: string): Manifest =>
  JSON.parse(readFileSync(join(repo, dir, 'package.json'), 'utf8')) as Manifest;

export const tracked = async (): Promise<string[]> =>
  (await $`git ls-files`.cwd(repo).quiet().text()).split('\n').filter(Boolean);

export function workspaces(files: readonly string[]): Workspace[] {
  const globs = (readManifest('.').workspaces ?? []).map((g) => new Glob(`${g}/package.json`));
  return files
    .filter((f) => globs.some((g) => g.match(f)))
    .map((f) => dirname(f))
    .map((dir) => ({ dir, manifest: readManifest(dir) }))
    .map((w) => ({ ...w, name: w.manifest.name }))
    .sort((a, b) => b.dir.length - a.dir.length);
}

/** The workspace whose folder is the longest prefix of `path`, if any. */
export const ownerOf = (path: string, all: readonly Workspace[]): Workspace | undefined =>
  all.find((w) => path === w.dir || path.startsWith(`${w.dir}/`));

export const SCRIPT = /\.(ts|tsx|mts|mjs)$/;

/**
 * Static, type-only, re-exported and dynamic imports, `typeof import()` and triple-slash path
 * references; comments and strings are not imports. The compiler reports an import at its opening
 * quote and a reference at its first character, so the offsets are normalised and checked.
 */
export function scriptSpecifiers(source: string): Specifier[] {
  const pre = ts.preProcessFile(source, true, true);
  const at = (fileName: string, pos: number, kind: Specifier['kind']): Specifier => {
    const start = source.startsWith(fileName, pos) ? pos : pos + 1;
    if (!source.startsWith(fileName, start)) throw new Error(`specifier ${fileName} is not at ${pos}`);
    return { text: fileName, start, end: start + fileName.length, kind };
  };
  return [
    ...pre.referencedFiles.map((f) => at(f.fileName, f.pos, 'reference')),
    ...pre.importedFiles.map((f) => at(f.fileName, f.pos, 'import')),
  ];
}

// Paths the compiler does not count as imports but a bundler or a test runner follows: Vite's glob
// import, a Worker or asset URL, a mocked module. Read from the syntax tree, so spacing, a list of
// patterns or a template literal without substitutions are all the same call.
const PATH_CALLEES = new Set([
  'import.meta.glob',
  'URL',
  'vi.mock',
  'vi.doMock',
  'vi.importActual',
  'vi.importMock',
  'mock.module',
]);

const literals = (node: ts.Expression | undefined): ts.StringLiteralLike[] => {
  if (!node) return [];
  if (ts.isStringLiteralLike(node)) return [node];
  return ts.isArrayLiteralExpression(node) ? node.elements.flatMap((e) => literals(e)) : [];
};

// A `.ts` file read as TSX takes `<T>(x: T) => x` for an element and loses what follows it.
export function pathCalls(source: string, file = 'x.ts'): Specifier[] {
  const kind = /\.[mc]?[jt]sx$/.test(file) ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const tree = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, false, kind);
  const out: Specifier[] = [];
  const visit = (node: ts.Node): void => {
    if (
      (ts.isCallExpression(node) || ts.isNewExpression(node)) &&
      PATH_CALLEES.has(node.expression.getText(tree))
    )
      for (const lit of literals(node.arguments?.[0]))
        if (isRelative(lit.text)) {
          const start = lit.getStart(tree) + 1;
          out.push({ text: lit.text, start, end: start + lit.text.length, kind: 'path-call' });
        }
    ts.forEachChild(node, visit);
  };
  visit(tree);
  return out;
}

const CSS_IMPORT = /@import\s+(?:url\(\s*)?["']([^"']+)["']/g;

export function cssImports(source: string): Specifier[] {
  return [...source.matchAll(CSS_IMPORT)].map((m) => {
    const text = m[1] ?? '';
    const start = (m.index ?? 0) + m[0].indexOf(text);
    return { text, start, end: start + text.length, kind: 'css-import' as const };
  });
}

export const specifiersOf = (file: string, source: string): Specifier[] =>
  file.endsWith('.css')
    ? cssImports(source)
    : SCRIPT.test(file)
      ? [...scriptSpecifiers(source), ...pathCalls(source, file)]
      : [];

const EXTENSIONS = ['', '.ts', '.tsx', '.mts', '.mjs', '.d.ts', '/index.ts', '/index.tsx'];

/** The repository-relative file a relative specifier names, or undefined when nothing is there. */
export function resolveRelative(fromFile: string, specifier: string): string | undefined {
  const bare = specifier.replace(/[?#].*$/, '');
  const base = resolve(repo, dirname(fromFile), bare);
  // `./x.js` names `x.ts` to Bun, TypeScript and Vite alike.
  const bases = [base, base.replace(/\.js$/, ''), base.replace(/\.jsx$/, '')];
  for (const b of new Set(bases))
    for (const ext of EXTENSIONS) {
      const candidate = `${b}${ext}`;
      if (existsSync(candidate) && statSync(candidate).isFile()) return relative(repo, candidate);
    }
  return undefined;
}

/**
 * Where a relative specifier points whether or not a file is there: a glob's fixed prefix, a file
 * that is gone. A boundary is about the folder reached, so this is what an owner is looked up by.
 */
export const reach = (fromFile: string, specifier: string): string =>
  relative(repo, resolve(repo, dirname(fromFile), specifier.replace(/[?#].*$/, '').replace(/\*.*$/, '')));

export const isRelative = (specifier: string): boolean => /^\.\.?(\/|$)/.test(specifier);

/** Shipped or run in production, as opposed to a test, an e2e file, a script or a tool's config. */
export const isProduction = (file: string): boolean =>
  !/(^|\/)(tests|e2e|scripts)\//.test(file) && !/\.(test|vitest|e2e)\.[a-z]+$|\.config\.[a-z]+$/.test(file);
