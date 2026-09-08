import { describe, expect, test } from 'bun:test';
import { initialSteps, type OpeningStep, openingIndeterminate, progressOf } from '../src/opening-steps.ts';

const withState = (over: Partial<Record<OpeningStep['id'], OpeningStep>> = {}): OpeningStep[] =>
  initialSteps().map((s) => ({ ...s, ...over[s.id] }));

describe('the opening steps', () => {
  test('the device and node start done; the weights sum to 100 across all five', () => {
    const steps = initialSteps('passkey');
    expect(steps.map((s) => s.state)).toEqual(['done', 'done', 'pending', 'pending', 'pending']);
    expect(progressOf(steps)).toBe(10); // key 5 + node 5
    const allDone = initialSteps().map((s) => ({ ...s, state: 'done' as const }));
    expect(progressOf(allDone)).toBe(100);
  });

  test('the active keys step adds its byte fraction of the 70-weight slice', () => {
    const half = withState({
      crs: { id: 'crs', label: 'proving keys', state: 'active', bytes: { loaded: 10, total: 20 } },
    });
    expect(progressOf(half)).toBe(10 + 35); // key 5 + node 5 + crs 70×0.5
    const done = withState({ crs: { id: 'crs', label: 'proving keys', state: 'done' } });
    expect(progressOf(done)).toBe(80); // key 5 + node 5 + crs 70
  });

  test('the notes step is indeterminate (its fraction is unknown); the keys step is not', () => {
    expect(
      openingIndeterminate(
        withState({ notes: { id: 'notes', label: 'notes and balance', state: 'active' } }),
      ),
    ).toBe(true);
    expect(
      openingIndeterminate(withState({ crs: { id: 'crs', label: 'proving keys', state: 'active' } })),
    ).toBe(false);
  });
});
