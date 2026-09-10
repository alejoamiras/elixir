import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { basename, join, relative } from 'node:path';
import type { SiteConfig } from './config.ts';
import { renderHeaders } from './headers.ts';

export class ArtifactError extends Error {}

type Fail = (why: string) => never;

const walk = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)],
  );

/** Anything that resolves to this machine: `localhost`, all of 127/8 (`127.1` included, once parsed), `::1`. */
const isLoopback = (hostname: string): boolean =>
  hostname === 'localhost' || hostname === '[::1]' || /^127\.\d+\.\d+\.\d+$/.test(hostname);

const URL_LITERAL = /https?:\/\/[^\s"'`<>)\\]+/gi;

/** A plaintext URL to a loopback host in `text`, in whatever case and spelling, or null. */
export function plaintextLoopback(text: string): string | null {
  for (const candidate of text.match(URL_LITERAL) ?? []) {
    let url: URL;
    try {
      url = new URL(candidate);
    } catch {
      continue;
    }
    if (url.protocol === 'http:' && isLoopback(url.hostname)) return candidate;
  }
  return null;
}

function checkRecord(out: string, fail: Fail): void {
  const record = join(out, 'build.json');
  if (!existsSync(record)) fail('no build.json');
  let mode: unknown;
  try {
    mode = (JSON.parse(readFileSync(record, 'utf8')) as { mode?: unknown }).mode;
  } catch {
    fail('build.json is not JSON');
  }
  if (mode !== 'production') fail(`build.json reports mode ${JSON.stringify(mode)}`);
}

function checkHeaders(out: string, files: string[], fail: Fail): void {
  // Cloudflare applies the root file to every path; a nested app's copy is documentation, not policy.
  if (!existsSync(join(out, '_headers'))) fail('no root _headers');
  const production = renderHeaders({ mode: 'production' });
  for (const h of files.filter((f) => basename(f) === '_headers'))
    if (readFileSync(h, 'utf8') !== production) fail(`${relative(out, h)} is not the production header map`);
}

function checkScripts(out: string, files: string[], fail: Fail): void {
  const scripts = files.filter((f) => /\.m?js$/.test(f));
  if (scripts.length === 0) fail('no scripts');
  for (const s of scripts) {
    const hit = plaintextLoopback(readFileSync(s, 'utf8'));
    if (hit) fail(`${relative(out, s)} names a plaintext loopback origin (${hit})`);
  }
}

/**
 * Throws unless `out` holds a production assembly: `build.json` says so, the root `_headers` exists
 * and every `_headers` is the production map, and no script names a plaintext loopback URL. This
 * catches what an e2e build leaves behind; a URL assembled from parts at runtime carries no literal
 * to find, which is why the resolved config is refused alongside.
 */
export function assertProductionArtifact(
  out: string,
  config: Pick<SiteConfig, 'mode' | 'queryOverrides' | 'prestoE2ePort'>,
): void {
  const fail: Fail = (why) => {
    throw new ArtifactError(`production artifact ${out}: ${why}`);
  };
  if (config.mode !== 'production') fail(`built in ${config.mode} mode`);
  if (config.queryOverrides || config.prestoE2ePort) fail('built with an e2e override resolved');
  if (!existsSync(out) || !statSync(out).isDirectory()) fail('no output directory');
  const files = walk(out);
  checkRecord(out, fail);
  checkHeaders(out, files, fail);
  checkScripts(out, files, fail);
}
