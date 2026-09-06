// The demo panel's three states and the run that drives them: one Worker per click, terminated
// whatever happens, a hard timeout so a slow machine ends in an honest message, not a spinner.
import type { DemoJob, DemoOut, DemoStepName } from '../../../web-miner/src/demo/index.ts';

export interface DemoStep {
  name: DemoStepName;
  ms: number;
}

export type DemoState =
  | { phase: 'before' }
  | { phase: 'proving'; steps: DemoStep[] }
  | { phase: 'done'; steps: DemoStep[]; score: number; proveMs: number }
  | { phase: 'error'; steps: DemoStep[]; message: string; timedOut: boolean };

export const TIMEOUT_MS = 90_000;

/** bb.js threads for a demo: leave a core to the page, never more than four. */
export const demoThreads = (cores: number): number =>
  Math.max(1, Math.min(4, (Number.isFinite(cores) ? Math.floor(cores) : 1) - 1));

export interface WorkerLike {
  postMessage(m: unknown): void;
  terminate(): void;
  onmessage: ((e: MessageEvent<DemoOut>) => void) | null;
  onerror: ((e: ErrorEvent) => void) | null;
}

export interface RunDeps {
  worker: () => WorkerLike;
  timeoutMs?: number;
  setTimeout?: typeof globalThis.setTimeout;
  clearTimeout?: typeof globalThis.clearTimeout;
}

const stepsOf = (s: DemoState): DemoStep[] => (s.phase === 'before' ? [] : s.steps);

export function reduce(state: DemoState, out: DemoOut): DemoState {
  const steps = stepsOf(state);
  switch (out.type) {
    case 'step':
      return { phase: 'proving', steps: [...steps, { name: out.name, ms: out.ms }] };
    case 'result':
      return { phase: 'done', steps, score: out.score, proveMs: out.proveMs };
    case 'error':
      return { phase: 'error', steps, message: out.message, timedOut: false };
  }
}

/**
 * Proves once. `onState` sees every transition; the promise settles with the final state. The
 * Worker is terminated in every path (result, error, timeout, a Worker that fails to load).
 */
export function runDemo(job: DemoJob, deps: RunDeps, onState: (s: DemoState) => void): Promise<DemoState> {
  const setT = deps.setTimeout ?? globalThis.setTimeout.bind(globalThis);
  const clearT = deps.clearTimeout ?? globalThis.clearTimeout.bind(globalThis);
  return new Promise((resolve) => {
    let state: DemoState = { phase: 'proving', steps: [] };
    let worker: WorkerLike | undefined;
    let timer: ReturnType<typeof setT> | undefined;
    let over = false;
    const finish = (final: DemoState) => {
      if (over) return;
      over = true;
      if (timer !== undefined) clearT(timer);
      try {
        worker?.terminate();
      } finally {
        state = final;
        onState(final);
        resolve(final);
      }
    };
    onState(state);
    try {
      worker = deps.worker();
    } catch (e) {
      finish({
        phase: 'error',
        steps: [],
        message: e instanceof Error ? e.message : String(e),
        timedOut: false,
      });
      return;
    }
    timer = setT(
      () => finish({ phase: 'error', steps: stepsOf(state), message: 'timed out', timedOut: true }),
      deps.timeoutMs ?? TIMEOUT_MS,
    );
    worker.onmessage = (e) => {
      if (over) return;
      state = reduce(state, e.data);
      if (state.phase === 'proving') onState(state);
      else finish(state);
    };
    worker.onerror = (e) =>
      finish({
        phase: 'error',
        steps: stepsOf(state),
        message: e.message || 'the Worker failed',
        timedOut: false,
      });
    worker.postMessage({ type: 'prove-once', job });
  });
}
