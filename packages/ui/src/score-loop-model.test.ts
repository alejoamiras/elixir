import { describe, expect, test } from 'vitest';
import { axis, flash, rise, ScoreLoopModel } from './score-loop-model.ts';

describe('ScoreLoopModel', () => {
  test('one dot per attempt at its real time; the window drops what is older than the span', () => {
    const m = new ScoreLoopModel(33.1, 10_000);
    m.push({ t: 0, score: 1.2 });
    m.push({ t: 2_600, score: 3.9 });
    m.push({ t: 5_200, score: 1.0 });
    expect(m.dots(5_200, true).map((d) => d.x)).toEqual([0.48, 0.74, 1]);
    m.push({ t: 12_000, score: 2 });
    expect(m.samples.map((s) => s.t)).toEqual([2_600, 5_200, 12_000]);
    expect(m.winAt).toBeNull();
  });

  test('a score at or above the difficulty is a win and starts the flash', () => {
    const m = new ScoreLoopModel(33.1);
    m.push({ t: 100, score: 33.1 });
    expect(m.winAt).toBe(100);
    expect(m.dots(100, true)[0]?.win).toBe(true);
    expect(flash(100, m.winAt)).toBe(1);
    expect(flash(1_000, m.winAt)).toBe(0);
    expect(flash(550, m.winAt)).toBeCloseTo(0.5);
  });

  test('the axis is log 1–1000, clamped, and a fresh dot rises over 420 ms unless motion is reduced', () => {
    expect(axis(1)).toBe(0);
    expect(axis(10)).toBeCloseTo(1 / 3);
    expect(axis(1000)).toBe(1);
    expect(axis(5000)).toBe(1);
    expect(axis(0.5)).toBe(0);
    expect(rise(0, 0)).toBe(0);
    expect(rise(420, 0)).toBe(1);
    expect(rise(210, 0)).toBeCloseTo(0.875);
    expect(rise(0, 0, true)).toBe(1);
  });
});
