// The shapes the bridge primitives take, in a plain module: the pages' pure modules build them
// without pulling the components in.
import type * as React from 'react';

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
