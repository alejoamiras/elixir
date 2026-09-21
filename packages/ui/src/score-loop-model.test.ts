import { describe, expect, test } from 'vitest';
import {
  axis,
  axisTo,
  axisTop,
  barSegments,
  calmTicks,
  clearOf,
  difficultyLabel,
  flash,
  labelsCollide,
  marginFor,
  nearestSample,
  plotGeometry,
  rise,
  ScoreLoopModel,
  spanBoxes,
  stepSample,
  won,
  xAt,
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

  test('a retarget re-judges nothing: each dot keeps the bar it was scored against', () => {
    const m = new ScoreLoopModel(109.5, 10_000);
    m.push({ t: 1_000, score: 40 });
    m.push({ t: 2_000, score: 120 });
    m.difficulty = 27.4; // the epoch closed at ×0.25
    m.push({ t: 3_000, score: 30 });
    expect(m.dots(3_000, true).map((d) => d.win)).toEqual([false, true, true]);
    expect(m.samples.map((s) => s.bar)).toEqual([109.5, 109.5, 27.4]);
    expect(won({ t: 0, score: 40 }, 27.4)).toBe(true); // no record: judged against the bar in force
    expect(won({ t: 0, score: 40, bar: 109.5 }, 27.4)).toBe(false);
    expect(won({ t: 0, score: 40, win: true }, null)).toBe(true);
  });

  test('the bar steps through the window at the samples that saw it change; the current bar runs to now', () => {
    const samples = [
      { t: 1_000, score: 1, bar: 109.5 },
      { t: 2_000, score: 1, bar: 109.5 },
      { t: 3_000, score: 1, bar: 27.4 },
    ];
    expect(barSegments(samples, 27.4, 4_000, 4_000)).toEqual([
      { x0: 0, x1: 0.5, bar: 109.5 },
      { x0: 0.5, x1: 1, bar: 27.4 },
    ]);
    // The epoch a segment opened with, from its first sample, names the tick where the bar stepped.
    expect(
      barSegments(
        [
          { t: 1_000, score: 1, bar: 109.5, epoch: 11 },
          { t: 3_000, score: 1, bar: 27.4, epoch: 12 },
        ],
        27.4,
        4_000,
        4_000,
      ),
    ).toEqual([
      { x0: 0, x1: 0.25, bar: 109.5, epoch: 11 },
      { x0: 0.25, x1: 1, bar: 27.4, epoch: 12 },
    ]);
    // Nothing in view, or samples without a bar: one flat line at the current bar.
    expect(barSegments([], 5, 0, 1_000)).toEqual([{ x0: 0, x1: 1, bar: 5 }]);
    expect(barSegments([{ t: 500, score: 2 }], 5, 1_000, 1_000)).toEqual([{ x0: 0, x1: 1, bar: 5 }]);
    // An old bar in view keeps the calm ceiling high enough for it.
    expect(axisTop(27.4, samples)).toBeCloseTo(2.5 * 109.5);
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

describe("the plot's geometry, and what is hit-tested against it", () => {
  // 3 minutes across 600 px: 300 ms a pixel.
  const g = plotGeometry({ width: 662, labelWidth: 24, floor: 48, now: 200_000, spanMs: 180_000 });
  const at = (t: number, score = 3, win = false) => ({ t, score, bar: 38.4, win });

  test("the margin follows the measured label and the title's column; time maps to one x", () => {
    expect(g).toEqual({ left: 48, right: 648, now: 200_000, span: 180_000 });
    expect(xAt(g, 200_000)).toBe(648);
    expect(xAt(g, 20_000)).toBe(48);
    // A label wider than the floor allows widens the margin; a resized canvas moves only the right edge.
    const wide = plotGeometry({
      width: 400,
      labelWidth: 60,
      floor: 48,
      now: 0,
      spanMs: 60_000,
      titled: true,
    });
    expect(wide).toMatchObject({ left: 76 + 14, right: 386 });
  });

  test('the ordinary proofs in view are one list for one path: wins and what aged out are not in it', () => {
    const samples = [at(10_000), at(50_000), at(110_000, 61.2, true), at(199_000), at(200_400)];
    expect(calmTicks(samples, 38.4, g).map((k) => k.s.t)).toEqual([50_000, 199_000]);
    expect(calmTicks(samples, 38.4, g)[0]?.x).toBeCloseTo(148);
  });

  test('a claim in view is clipped to the plot; a live one rides now; one that ended before the window is gone', () => {
    const boxes = spanBoxes(
      [
        { id: 1, t0: 1_000, t1: 15_000, outcome: 'minted' },
        { id: 2, t0: 8_000, t1: 50_000, outcome: 'failed' },
        { id: 3, t0: 170_000, t1: null },
      ],
      g,
    );
    expect(boxes.map((b) => ({ ...b, x0: Math.round(b.x0), x1: Math.round(b.x1) }))).toEqual([
      { x0: 48, x1: 148, opened: false, live: false, outcome: 'failed', ms: 42_000 },
      { x0: 548, x1: 648, opened: true, live: true, ms: 30_000 },
    ]);
  });

  test('the nearest proof within reach, by the frame that was drawn: a grown window and an aged-out proof', () => {
    const samples = [at(10_000), at(50_000), at(51_500), at(199_000)];
    expect(nearestSample(samples, g, 150)?.t).toBe(50_000);
    expect(nearestSample(samples, g, 152)?.t).toBe(51_500);
    expect(nearestSample(samples, g, 300)).toBeNull();
    // The first proof left the window: a pointer where it would have been finds nothing.
    expect(nearestSample(samples, g, xAt(g, 10_000))).toBeNull();
    // The calm window while it is still a minute wide: the same proof sits elsewhere, and is found there.
    const young = { ...g, now: 60_000, span: 60_000 };
    expect(xAt(young, 50_000)).toBe(548);
    expect(nearestSample(samples, young, 548)?.t).toBe(50_000);
  });

  test('the arrow keys walk the proofs in view, newest first, and stop at the ends', () => {
    const samples = [at(10_000), at(50_000), at(199_000)];
    expect(stepSample(samples, g, null, -1)?.t).toBe(199_000);
    expect(stepSample(samples, g, samples[2] ?? null, -1)?.t).toBe(50_000);
    expect(stepSample(samples, g, samples[1] ?? null, -1)?.t).toBe(50_000);
    expect(stepSample(samples, g, samples[1] ?? null, 1)?.t).toBe(199_000);
  });
});
