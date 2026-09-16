import { describe, expect, test } from 'bun:test';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative, resolve } from 'node:path';
import { lifecycleAfter, writeLifecycle } from './lifecycle.ts';

const repo = resolve(import.meta.dir, '../../../..');

describe('the lifecycle block', () => {
  test('a stop is noted once, on the version’s own record, as a unix time; the node after the stop', () => {
    const v5 = { rollupVersion: '5' };
    expect(lifecycleAfter(v5, 'note-stop', '5', '1800000000')).toEqual({ stoppedProvingAt: '1800000000' });
    expect(() => lifecycleAfter(v5, 'note-stop', '6', '1800000000')).toThrow(/the record is version 5/);
    expect(() => lifecycleAfter(v5, 'note-stop', '5', '2026-09-21')).toThrow(/not a unix time/);
    const stopped = { ...v5, lifecycle: { stoppedProvingAt: '1800000000' } };
    expect(() => lifecycleAfter(stopped, 'note-stop', '5', '1800000001')).toThrow(
      /already noted at 1800000000/,
    );
    expect(() => lifecycleAfter(v5, 'retire-node', '5', '')).toThrow(/note-stop first/);
    expect(lifecycleAfter(stopped, 'retire-node', '5', '')).toEqual({
      stoppedProvingAt: '1800000000',
      nodeRetired: true,
    });
    expect(() =>
      lifecycleAfter(
        { ...stopped, lifecycle: { ...stopped.lifecycle, nodeRetired: true } },
        'retire-node',
        '5',
        '',
      ),
    ).toThrow(/already noted as retired/);
  });

  test('the write lands in the record beside everything else, and only there', () => {
    const dir = mkdtempSync(join(tmpdir(), 'yacana-lifecycle-'));
    const file = join(dir, 'record.json');
    writeFileSync(
      file,
      `${JSON.stringify({ profile: 'x', rollupVersion: '5', bridge: { portal: '0x1' } })}\n`,
    );
    // The writer takes a path relative to the repo root, as YACANA_RECORD is.
    const path = relative(repo, file);
    expect(writeLifecycle(path, 'note-stop', '5', '1800000000')).toEqual({ stoppedProvingAt: '1800000000' });
    expect(writeLifecycle(path, 'retire-node', '5')).toEqual({
      stoppedProvingAt: '1800000000',
      nodeRetired: true,
    });
    expect(JSON.parse(readFileSync(file, 'utf8'))).toEqual({
      profile: 'x',
      rollupVersion: '5',
      bridge: { portal: '0x1' },
      lifecycle: { stoppedProvingAt: '1800000000', nodeRetired: true },
    });
  });
});
