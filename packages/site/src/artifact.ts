// What a production assembly must look like, checked over the files it emitted rather than the
// config that was meant to produce them. Assembly is the last step every supported deploy takes, so
// a contaminated build that got past the config is stopped here or not at all.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import type { SiteConfig } from './config.ts';
import { renderHeaders } from './headers.ts';

/** The e2e lane's node and Presto speak plaintext on loopback; nothing that ships may name either. */
const PLAINTEXT_LOOPBACK = /http:\/\/(127\.0\.0\.1|localhost)\b/;

export class ArtifactError extends Error {}

type Fail = (why: string) => never;

const walk = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)],
  );

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

/** Every `_headers` — the root's and each nested app's — is the production map, byte for byte. */
function checkHeaders(out: string, files: string[], fail: Fail): void {
  const headers = files.filter((f) => f.endsWith('_headers'));
  if (headers.length === 0) fail('no _headers');
  const production = renderHeaders({ mode: 'production' });
  for (const h of headers)
    if (readFileSync(h, 'utf8') !== production) fail(`${relative(out, h)} is not the production header map`);
}

function checkScripts(out: string, files: string[], fail: Fail): void {
  const scripts = files.filter((f) => /\.m?js$/.test(f));
  if (scripts.length === 0) fail('no scripts');
  for (const s of scripts)
    if (PLAINTEXT_LOOPBACK.test(readFileSync(s, 'utf8')))
      fail(`${relative(out, s)} names a plaintext loopback origin`);
}

/**
 * Throws unless `out` holds a production assembly: a `build.json` that says so, every `_headers` equal
 * to the production header map (no local `connect-src`), and no script naming a plaintext loopback
 * origin. Missing or unreadable pieces fail. This finds the contamination an e2e build would leave —
 * the literals and the mode — not every way a bundle could misbehave; a URL assembled from parts at
 * runtime contains neither literal, which is why the resolved config is refused alongside.
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
