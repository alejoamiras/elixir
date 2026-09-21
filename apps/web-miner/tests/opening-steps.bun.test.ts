import { describe, expect, test } from 'bun:test';
import {
  barShown,
  elapsed,
  initialSteps,
  keyStepLabel,
  type OpeningStep,
  progressOf,
} from '../src/opening-steps.ts';

const withState = (over: Partial<Record<OpeningStep['id'], Partial<OpeningStep>>> = {}): OpeningStep[] =>
  initialSteps().map((s) => ({ ...s, ...over[s.id] }));

describe('the opening steps', () => {
  test('four stages, pending until the ceremony ends; the weights sum to 100', () => {
    const steps = initialSteps(keyStepLabel('words'));
    expect(steps.map((s) => s.id)).toEqual(['key', 'crs', 'notes', 'ready']);
    expect(steps[0]?.label).toBe('12 words accepted');
    expect(initialSteps()[0]?.label).toBe('Passkey confirmed');
    expect(steps.every((s) => s.state === 'pending')).toBe(true);
    expect(progressOf(withState({ key: { state: 'done' } }))).toBe(5);
    expect(progressOf(steps.map((s) => ({ ...s, state: 'done' as const })))).toBe(100);
  });

  test('the bar shows only while the keys land, at the key weight plus the byte fraction of the keys slice', () => {
    const half = withState({
      key: { state: 'done' },
      crs: { state: 'active', bytes: { loaded: 10, total: 20 } },
    });
    expect(barShown(half)).toBe(true);
    expect(progressOf(half)).toBe(5 + 30);
    const unknown = withState({ key: { state: 'done' }, crs: { state: 'active' } });
    expect(barShown(unknown)).toBe(false);
    const syncing = withState({ key: { state: 'done' }, crs: { state: 'done' }, notes: { state: 'active' } });
    expect(barShown(syncing)).toBe(false);
    expect(progressOf(syncing)).toBe(65);
  });

  test('the elapsed time reads m:ss', () => {
    expect(elapsed(1000, 43_000)).toBe('0:42');
    expect(elapsed(0, 61_000)).toBe('1:01');
    expect(elapsed(5000, 4000)).toBe('0:00');
  });
});
