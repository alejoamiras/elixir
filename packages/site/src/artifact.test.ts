import { afterEach, describe, expect, test } from 'bun:test';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { assertProductionArtifact } from './artifact.ts';
import { renderHeaders } from './headers.ts';

const production = { mode: 'production', queryOverrides: false, prestoE2ePort: '' } as const;

/** The smallest assembly that passes: a record, a header map, one nested app with a script and its own headers. */
function assembly(): string {
  const out = mkdtempSync(join(tmpdir(), 'yacana-artifact-'));
  const headers = renderHeaders({ mode: 'production' });
  writeFileSync(join(out, 'build.json'), JSON.stringify({ mode: 'production', commit: 'abc' }));
  writeFileSync(join(out, '_headers'), headers);
  mkdirSync(join(out, 'mine/assets'), { recursive: true });
  writeFileSync(join(out, 'mine/_headers'), headers);
  writeFileSync(join(out, 'mine/assets/index-abc.js'), 'fetch("https://node.example/rpc")');
  writeFileSync(join(out, 'mine/assets/worker-def.js'), 'self.onmessage=()=>{}');
  return out;
}

const made: string[] = [];
const fresh = () => {
  const out = assembly();
  made.push(out);
  return out;
};
afterEach(() => {
  for (const out of made.splice(0)) rmSync(out, { recursive: true, force: true });
});

describe('the production artifact contract', () => {
  test('a clean assembly passes', () => {
    expect(() => assertProductionArtifact(fresh(), production)).not.toThrow();
  });

  test('a script naming a plaintext loopback origin fails, wherever it sits', () => {
    const out = fresh();
    writeFileSync(join(out, 'mine/assets/worker-def.js'), 'const node="http://127.0.0.1:24567/rpc"');
    expect(() => assertProductionArtifact(out, production)).toThrow(
      /worker-def\.js names a plaintext loopback/,
    );
    writeFileSync(join(out, 'mine/assets/worker-def.js'), 'x');
    writeFileSync(join(out, 'mine/assets/index-abc.js'), 'presto("http://localhost:59833/health")');
    expect(() => assertProductionArtifact(out, production)).toThrow(
      /index-abc\.js names a plaintext loopback/,
    );
  });

  test('a header map that admits local nodes fails, even in a nested app', () => {
    const out = fresh();
    writeFileSync(join(out, 'mine/_headers'), renderHeaders({ mode: 'e2e' }));
    expect(() => assertProductionArtifact(out, production)).toThrow(
      /mine\/_headers is not the production header map/,
    );
  });

  test('missing or wrong pieces fail rather than pass by absence', () => {
    const noRecord = fresh();
    rmSync(join(noRecord, 'build.json'));
    expect(() => assertProductionArtifact(noRecord, production)).toThrow(/no build\.json/);

    const badRecord = fresh();
    writeFileSync(join(badRecord, 'build.json'), '{not json');
    expect(() => assertProductionArtifact(badRecord, production)).toThrow(/not JSON/);

    const e2eRecord = fresh();
    writeFileSync(join(e2eRecord, 'build.json'), JSON.stringify({ mode: 'e2e' }));
    expect(() => assertProductionArtifact(e2eRecord, production)).toThrow(/reports mode "e2e"/);

    const noHeaders = fresh();
    rmSync(join(noHeaders, '_headers'));
    rmSync(join(noHeaders, 'mine/_headers'));
    expect(() => assertProductionArtifact(noHeaders, production)).toThrow(/no _headers/);

    const noScripts = fresh();
    rmSync(join(noScripts, 'mine/assets'), { recursive: true });
    expect(() => assertProductionArtifact(noScripts, production)).toThrow(/no scripts/);

    expect(() => assertProductionArtifact(join(tmpdir(), 'yacana-never-made'), production)).toThrow(
      /no output directory/,
    );
  });

  test('a config that resolved an e2e hook fails before any file is read', () => {
    const out = fresh();
    expect(() => assertProductionArtifact(out, { ...production, queryOverrides: true })).toThrow(
      /e2e override/,
    );
    expect(() => assertProductionArtifact(out, { ...production, prestoE2ePort: '24567' })).toThrow(
      /e2e override/,
    );
    expect(() => assertProductionArtifact(out, { ...production, mode: 'e2e' })).toThrow(/built in e2e mode/);
  });
});
