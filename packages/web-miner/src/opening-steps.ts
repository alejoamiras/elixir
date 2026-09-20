import type { Step } from '../../ui/src/index.ts';

/** The four stages the dialog lists; the node's health is the preflight's, not an opening step. */
export type StepId = 'key' | 'crs' | 'notes' | 'ready';

/** A boot step for the opening dialog: ui's Step, the keys step's bytes, and when the step went active. */
export interface OpeningStep extends Step {
  id: StepId;
  bytes?: { loaded: number; total: number };
  /** Epoch ms when the step went active: the elapsed time shown where no count is known. */
  since?: number;
  /** Why the step failed, for the right column. */
  reason?: string;
}

/**
 * The bar's width is the finished steps' weights plus the active keys step's byte fraction. Only the
 * download has a count, so the bar shows during it alone; the weights size a first visit on a real
 * network (20 MB of keys against a sync usually under a minute), which a local run cannot measure.
 */
const WEIGHTS: Record<StepId, number> = { key: 5, crs: 60, notes: 30, ready: 5 };

const LABEL: Record<StepId, string> = {
  key: 'Passkey confirmed',
  crs: 'Preparing your miner',
  notes: 'Syncing your private balance',
  ready: 'Ready to mine',
};

/** The first step's label for the account's kind. */
export const keyStepLabel = (kind: 'passkey' | 'words'): string =>
  kind === 'words' ? '12 words accepted' : LABEL.key;

/** The four steps; the ceremony (the key step) is the active one until it ends. */
export function initialSteps(keyLabel = LABEL.key): OpeningStep[] {
  return (Object.keys(WEIGHTS) as StepId[]).map((id) => ({
    id,
    label: id === 'key' ? keyLabel : LABEL[id],
    state: 'pending',
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

/** The bar shows only where the count is known: the keys step, while its bytes land. */
export const barShown = (steps: readonly OpeningStep[]): boolean =>
  steps.some((s) => s.state === 'active' && s.id === 'crs' && s.bytes !== undefined && s.bytes.total > 0);

/** The keys step's right column while it downloads: MB landed of the pinned total. */
export const bytesDetail = (bytes: { loaded: number; total: number }): string =>
  `${(bytes.loaded / 2 ** 20).toFixed(1)} of ${Math.round(bytes.total / 2 ** 20)} MB`;

/** `m:ss` since a step went active. */
export const elapsed = (since: number, now: number): string => {
  const s = Math.max(0, Math.floor((now - since) / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};
