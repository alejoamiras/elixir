import { afterEach, describe, expect, test } from 'bun:test';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { assertProductionArtifact, plaintextLoopback } from './artifact.ts';
import { renderHeaders } from './headers.ts';

const production = { mode: 'production', queryOverrides: false, prestoE2ePort: '' } as const;

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

describe('plaintextLoopback', () => {
  test('finds a loopback URL in any case or spelling, and ignores https and other hosts', () => {
    for (const bad of [
      'http://127.0.0.1:24567/rpc',
      'HTTP://LOCALHOST:1/health',
      'http://[::1]:1',
      'http://127.0.0.2:1',
      'http://127.1:1',
      'x="http://localhost"',
    ])
      expect(plaintextLoopback(bad), bad).not.toBeNull();
    for (const fine of [
      'https://127.0.0.1:59834/health',
      'https://localhost/x',
      'http://node.example/rpc',
      'http://10.0.0.1/x',
      'localhost',
      'the string http:// alone',
    ])
      expect(plaintextLoopback(fine), fine).toBeNull();
  });
});

describe('the production artifact contract', () => {
  test('a clean assembly passes', () => {
    expect(() => assertProductionArtifact(fresh(), production)).not.toThrow();
  });

  test('a script naming a plaintext loopback origin fails, wherever it sits and however spelled', () => {
    const out = fresh();
    writeFileSync(join(out, 'mine/assets/worker-def.js'), 'const node="http://127.0.0.1:24567/rpc"');
    expect(() => assertProductionArtifact(out, production)).toThrow(
      /worker-def\.js names a plaintext loopback/,
    );
    writeFileSync(join(out, 'mine/assets/worker-def.js'), 'x');
    writeFileSync(join(out, 'mine/assets/index-abc.js'), 'presto("HTTP://[::1]:59833/health")');
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

  test('the root _headers is required; a nested copy does not stand in for it', () => {
    const out = fresh();
    rmSync(join(out, '_headers'));
    expect(() => assertProductionArtifact(out, production)).toThrow(/no root _headers/);
    writeFileSync(join(out, 'backup_headers'), 'not a policy file');
    expect(() => assertProductionArtifact(out, production)).toThrow(/no root _headers/);
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
