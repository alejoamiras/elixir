import { describe, expect, test } from 'bun:test';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { RECORDING_FILE, type Recording, type ReplayBinding } from '../e2e/replay/run.ts';
import { bindingDrift, currentBinding } from '../e2e/replay/setup.ts';

const pkg = resolve(import.meta.dir, '..');
const recording = JSON.parse(readFileSync(RECORDING_FILE, 'utf8')) as Recording;
const FIELDS = Object.keys(recording.binding) as (keyof ReplayBinding)[];

describe('the replay recording is bound to the tree it was taken from', () => {
  test('the committed recording matches the committed artifacts, layouts and SDK', () => {
    expect(FIELDS.map(String).sort()).toEqual(
      ['aztecVersion', 'layoutsSha256', 'minerArtifactSha256', 'tokenArtifactSha256'].sort(),
    );
    expect(bindingDrift(recording.binding, currentBinding())).toEqual([]);
  });

  test('each moved input names itself', () => {
    const current = currentBinding();
    for (const field of FIELDS)
      expect(bindingDrift({ ...current, [field]: 'moved' }, current)).toEqual([field]);
  });

  test('serve refuses a stale recording, naming the field, before it reaches the preview helpers', () => {
    const dir = mkdtempSync(join(tmpdir(), 'yacana-replay-'));
    try {
      const stale = join(dir, 'recording.json');
      writeFileSync(
        stale,
        JSON.stringify({ ...recording, binding: { ...recording.binding, minerArtifactSha256: 'moved' } }),
      );
      // The preload turns any reach into the preview helpers into a sentinel error, so a regressed
      // guard fails here instead of claiming a port and leaving a preview running.
      const r = spawnSync(
        'bun',
        ['--preload', resolve(pkg, 'tests/replay-refusal.preload.ts'), 'e2e/replay/setup.ts', 'serve'],
        {
          cwd: pkg,
          encoding: 'utf8',
          timeout: 20_000,
          env: { ...process.env, YACANA_REPLAY_RECORDING: stale },
        },
      );
      expect(r.status).not.toBe(0);
      expect(r.stderr).toMatch(/taken against other inputs \(minerArtifactSha256\)/);
      expect(r.stderr).not.toMatch(/PREVIEW_REACHED/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
