// The shapes the bridge primitives take, in a plain module: the pages' pure modules build them
// without pulling the components in.
import type * as React from 'react';

export type ChipTone = 'ok' | 'on' | 'warn' | 'bad' | 'dim' | 'done';

export type TrailState = 'todo' | 'on' | 'done' | 'bad' | 'warn';

export interface TrailItem {
  label: React.ReactNode;
  state: TrailState;
  /** The station's key when its label is not a string, or repeats. */
  id?: string;
}

export type TimelineState = 'todo' | 'on' | 'done' | 'bad';

export interface TimelineItem {
  id: string;
  label: React.ReactNode;
  detail?: React.ReactNode;
  state: TimelineState;
}

export interface BarSegment {
  id: string;
  label: React.ReactNode;
  /** The figure the legend prints beside the label. */
  figure: React.ReactNode;
  /** A share of the bar; the segments are scaled to their sum (a zero sum draws nothing). */
  value: number;
  /** A CSS colour: a token (`var(--uv)`) or any value. */
  color: string;
}

export type RowAction = 'claim' | 'claim-l1' | 'forward' | 'redeem' | 'again' | 'settings';

/**
 * Everything the activity row says about one crossing, built by the app: the row renders it and
 * decides nothing. `action` is the button; `action.disabled` is the reason it cannot run yet — a
 * money button that is off says why. `also` is a second, quieter way out, a link in the line under
 * the row, and `note` the rest of that line: what the way out is bounded by.
 */
export interface RowLine {
  chip: { word: string; tone: ChipTone };
  sentence: string;
  trail: TrailItem[];
  action?: { kind: RowAction; label: string; disabled?: string };
  also?: { kind: RowAction; label: string };
  note?: string;
  /** Work under way on this page, 0–1 against its usual time: a bar under the sentence. */
  progress?: number;
}
