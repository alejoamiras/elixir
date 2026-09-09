import { describe, expect, test } from 'vitest';
import {
  axis,
  axisTo,
  axisTop,
  clearOf,
  difficultyLabel,
  flash,
  labelsCollide,
  marginFor,
  rise,
  ScoreLoopModel,
} from './score-loop-model.ts';

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
    expect(difficultyLabel(33.14)).toBe('33.1');
    expect(difficultyLabel(2 ** 128)).toBe('3.4e38');
    expect(axis(0.5)).toBe(0);
    expect(rise(0, 0)).toBe(0);
    expect(rise(420, 0)).toBe(1);
    expect(rise(210, 0)).toBeCloseTo(0.875);
    expect(rise(0, 0, true)).toBe(1);
  });
});

test('the calm ceiling follows the bar and the best score in view, and an empty window still has room', () => {
  expect(axisTop(3.3, [])).toBeCloseTo(8.25);
  expect(axisTop(3.3, [{ t: 0, score: 5.2 }])).toBeCloseTo(8.25);
  expect(axisTop(3.3, [{ t: 0, score: 12 }])).toBeCloseTo(15);
  expect(axisTop(0.5, [])).toBe(2);
  expect(axisTo(1, 8)).toBe(0);
  expect(axisTo(8, 8)).toBe(1);
  expect(axisTo(0.2, 8)).toBe(0);
  expect(axisTo(64, 8)).toBe(1);
});

test('the baseline label yields within a line of type of the bar; the margin fits the widest label', () => {
  expect(labelsCollide(200, 200, 10)).toBe(true);
  expect(labelsCollide(189, 200, 10)).toBe(true);
  expect(labelsCollide(188, 200, 10)).toBe(false);
  expect(labelsCollide(150, 200, 11)).toBe(false);
  // "56.2" at 10 px mono is ~24 px: 24 + 8 + 8 = 40, over the pop-out's 28 px floor; "3.3" stays on the floor.
  expect(marginFor(24, 28)).toBe(40);
  expect(marginFor(18, 28)).toBe(34);
  expect(marginFor(10, 28)).toBe(28);
  expect(marginFor(52.4, 48)).toBe(69);
});

test('a win label steps down past the labels already drawn, never past the baseline', () => {
  const first = { x0: 800, x1: 874, y: 332 };
  expect(clearOf([], first, 10, 396)).toBe(332);
  // The same row, overlapping in x: one line down; a third one another line down.
  expect(clearOf([first], { x0: 790, x1: 863, y: 332 }, 10, 396)).toBe(344);
  expect(clearOf([first, { x0: 790, x1: 863, y: 344 }], { x0: 795, x1: 869, y: 332 }, 10, 396)).toBe(356);
  // Apart in x, or already a line apart: untouched.
  expect(clearOf([first], { x0: 600, x1: 674, y: 332 }, 10, 396)).toBe(332);
  expect(clearOf([first], { x0: 790, x1: 863, y: 345 }, 10, 396)).toBe(345);
  // No room below: the label keeps its place rather than leaving the plot.
  expect(clearOf([{ x0: 800, x1: 874, y: 390 }], { x0: 790, x1: 863, y: 390 }, 10, 396)).toBe(390);
});
