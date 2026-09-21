// The repository as the guards and the specifier codemod see it: the workspaces, every specifier a
// tracked file holds with its position, and which workspace owns a path.
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
  kind: 'import' | 'reference' | 'css-import';
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

const CSS_IMPORT = /@import\s+(?:url\(\s*)?["']([^"']+)["']/g;

export function cssImports(source: string): Specifier[] {
  return [...source.matchAll(CSS_IMPORT)].map((m) => {
    const text = m[1] ?? '';
    const start = (m.index ?? 0) + m[0].indexOf(text);
    return { text, start, end: start + text.length, kind: 'css-import' as const };
  });
}

export const specifiersOf = (file: string, source: string): Specifier[] =>
  file.endsWith('.css') ? cssImports(source) : SCRIPT.test(file) ? scriptSpecifiers(source) : [];

const EXTENSIONS = ['', '.ts', '.tsx', '.mts', '.mjs', '.d.ts', '/index.ts', '/index.tsx'];

/** The repository-relative file a relative specifier names, or undefined when nothing is there. */
export function resolveRelative(fromFile: string, specifier: string): string | undefined {
  const bare = specifier.replace(/[?#].*$/, '');
  const base = resolve(repo, dirname(fromFile), bare);
  for (const ext of EXTENSIONS) {
    const candidate = `${base}${ext}`;
    if (existsSync(candidate) && statSync(candidate).isFile()) return relative(repo, candidate);
  }
  return undefined;
}

export const isRelative = (specifier: string): boolean => /^\.\.?(\/|$)/.test(specifier);

/** Shipped or run in production, as opposed to a test, an e2e file, a script or a tool's config. */
export const isProduction = (file: string): boolean =>
  !/(^|\/)(tests|e2e|scripts)\//.test(file) && !/\.(test|vitest|e2e)\.[a-z]+$|\.config\.[a-z]+$/.test(file);
