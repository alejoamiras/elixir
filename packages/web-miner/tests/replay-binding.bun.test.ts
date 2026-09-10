import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { RECORDING_FILE, type Recording } from '../e2e/replay/run.ts';
import { bindingDrift, currentBinding } from '../e2e/replay/setup.ts';

describe('the replay recording is bound to the tree it was taken from', () => {
  const recording = JSON.parse(readFileSync(RECORDING_FILE, 'utf8')) as Recording;

  test('the committed recording matches the committed artifacts, layouts and SDK', () => {
    expect(bindingDrift(recording.binding, currentBinding())).toEqual([]);
  });

  test('one moved input names itself, and the lane would refuse the recording', () => {
    const current = currentBinding();
    expect(bindingDrift({ ...current, layoutsSha256: 'deadbeef' }, current)).toEqual(['layoutsSha256']);
    expect(bindingDrift({ ...current, aztecVersion: '5.1.0' }, current)).toEqual(['aztecVersion']);
  });
});
