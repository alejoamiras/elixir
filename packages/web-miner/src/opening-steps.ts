import type { Step } from '../../ui/src/index.ts';

export type StepId = 'key' | 'node' | 'crs' | 'notes' | 'ready';

/** A boot step for the opening dialog: ui's Step, plus the byte progress the keys step carries. */
export interface OpeningStep extends Step {
  id: StepId;
  bytes?: { loaded: number; total: number };
}

/** The bar's width is the finished steps' weights plus the active keys step's byte fraction. */
const WEIGHTS: Record<StepId, number> = { key: 5, node: 5, crs: 70, notes: 15, ready: 5 };

const LABEL: Record<StepId, string> = {
  key: 'your device',
  node: 'the node answers for this deployment',
  crs: 'proving keys',
  notes: 'notes and balance',
  ready: 'ready to mine',
};

/**
 * The five steps. The device (the ceremony) and the node (the preflight) are already done when the
 * opening body first shows; `keyLabel` names the first one for the account's kind (passkey, words).
 */
export function initialSteps(keyLabel = LABEL.key): OpeningStep[] {
  return (Object.keys(WEIGHTS) as StepId[]).map((id) => ({
    id,
    label: id === 'key' ? keyLabel : LABEL[id],
    state: id === 'key' || id === 'node' ? 'done' : 'pending',
  }));
}

/** 0–100: each finished step's weight, plus the active keys step's byte fraction of its weight. */
export function progressOf(steps: readonly OpeningStep[]): number {
  let pct = 0;
  for (const s of steps) {
    if (s.state === 'done') pct += WEIGHTS[s.id];
    else if (s.state === 'active' && s.id === 'crs' && s.bytes && s.bytes.total > 0)
      pct += (WEIGHTS.crs * s.bytes.loaded) / s.bytes.total;
  }
  return Math.min(100, Math.max(0, Math.round(pct)));
}

/** The active step's fraction is unknown (the notes step): the bar moves inside that step's slice. */
export const openingIndeterminate = (steps: readonly OpeningStep[]): boolean =>
  steps.some((s) => s.state === 'active' && s.id === 'notes');

/** The notes step's share of the bar, for the stripe's width. */
export const NOTES_SPAN = WEIGHTS.notes;

/** The keys step's second line while it downloads: MB landed of the pinned total. */
export const bytesDetail = (bytes: { loaded: number; total: number }): string =>
  `${(bytes.loaded / 2 ** 20).toFixed(1)} of ${Math.round(bytes.total / 2 ** 20)} MB`;
