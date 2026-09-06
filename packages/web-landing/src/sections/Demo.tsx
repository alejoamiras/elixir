// The hero's right side: the score loop with the chain's real difficulty (a cadence of dots until
// the visitor's own proof joins), then the three states of "Prove one now".
import { useEffect, useMemo, useState } from 'react';
import { difficulty, nextWinSeconds } from '../../../miner-core/src/metrics.ts';
import type { EpochRow } from '../../../miner-core/src/reader.ts';
import { duration } from '../../../site/src/browser/format.ts';
import { Button, type Sample, ScoreLoop } from '../../../ui/src/index.ts';
import type { DemoJob } from '../../../web-miner/src/demo/index.ts';
import { copy } from '../copy';
import type { DemoState } from '../demo/machine';
import { appHref } from '../state';

/** A dot every few seconds with a real score distribution: 1/u for u uniform in (0, 1]. */
function useCadence(spanMs: number): Sample[] {
  const [samples, setSamples] = useState<Sample[]>([]);
  useEffect(() => {
    const tick = () => {
      const now = performance.now();
      setSamples((s) => [...s.filter((x) => now - x.t < spanMs), { t: now, score: 1 / (1 - Math.random()) }]);
    };
    tick();
    const id = setInterval(tick, 2800);
    return () => clearInterval(id);
  }, [spanMs]);
  return samples;
}

const SPAN_MS = 60_000;

const sec = (ms: number) => `${(ms / 1000).toFixed(1)} s`;

function Steps({ state }: { state: Extract<DemoState, { phase: 'proving' | 'done' | 'error' }> }) {
  const names = ['crs', 'prover', 'proof', 'score'] as const;
  return (
    <ol className="flex flex-col gap-1 font-mono text-xs" data-testid="demo-steps">
      {names.map((name) => {
        const step = state.steps.find((s) => s.name === name);
        const active = !step && state.phase === 'proving' && state.steps.length === names.indexOf(name);
        return (
          <li key={name} className="flex justify-between gap-4" data-step={name} data-done={step ? '1' : ''}>
            <span className={step || active ? 'text-ink' : 'text-ink-3'}>{copy.demo.steps[name]}</span>
            <span className="text-ink-2">{step ? sec(step.ms) : active ? '…' : ''}</span>
          </li>
        );
      })}
    </ol>
  );
}

function Result({ state, target }: { state: Extract<DemoState, { phase: 'done' }>; target: bigint }) {
  const bar = difficulty(target);
  const perMinute = 60_000 / state.proveMs;
  return (
    <div className="flex flex-col gap-3" data-testid="demo-result">
      <p className="eyebrow">
        {copy.demo.proved} · {sec(state.proveMs)}
      </p>
      <div className="grid grid-cols-3 gap-3 font-mono">
        <div>
          <p className="text-2xs text-ink-2">{copy.demo.yourScore}</p>
          <p className="text-2xl" data-testid="demo-score">
            {state.score.toFixed(1)}
          </p>
        </div>
        <div>
          <p className="text-2xs text-ink-2">{copy.demo.bar}</p>
          <p className="text-2xl">{bar.toFixed(1)}</p>
        </div>
        <div>
          <p className="text-2xs text-ink-2">{copy.demo.odds}</p>
          <p className="text-2xl">≈ 1 in {Math.ceil(bar)}</p>
        </div>
      </div>
      <p className="text-sm text-ink-2">
        At this speed ({perMinute.toFixed(1)} proofs/min) you would clear the bar about every{' '}
        {duration(Math.round(nextWinSeconds(target, perMinute)))} on today's testnet.
      </p>
    </div>
  );
}

export function Demo({
  open,
  job,
  state,
  onProve,
}: {
  open: EpochRow | undefined;
  job: DemoJob | null;
  state: DemoState;
  onProve: () => void;
}) {
  const cadence = useCadence(SPAN_MS);
  const own = useMemo<Sample[]>(
    () => (state.phase === 'done' ? [{ t: performance.now(), score: state.score }] : []),
    [state],
  );
  const bar = open ? difficulty(open.target) : 1;
  const busy = state.phase === 'proving';
  return (
    <div className="flex flex-col gap-4 rounded-md border border-line bg-panel p-4" data-testid="demo">
      <p className="eyebrow" data-testid="demo-caption">
        {open
          ? `epoch ${open.epoch} · difficulty ${bar.toFixed(1)} · the bar is live from the chain`
          : copy.live.loading}
      </p>
      <ScoreLoop difficulty={bar} samples={[...cadence, ...own]} spanMs={SPAN_MS} height={140} hero />
      {state.phase === 'before' ? (
        <p className="text-sm text-ink-2">{copy.demo.before}</p>
      ) : (
        <>
          <p className="eyebrow">
            {copy.demo.proving} · {job?.threads ?? 1} threads
          </p>
          <Steps state={state} />
          {state.phase === 'error' && (
            <p className="text-sm text-bad" data-testid="demo-error">
              {state.timedOut ? copy.demo.timeout : `${copy.demo.failed}: ${state.message}`}
            </p>
          )}
          {state.phase === 'done' && open && <Result state={state} target={open.target} />}
        </>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="uv" onClick={onProve} disabled={busy || !job} data-testid="prove">
          {state.phase === 'before' || busy ? copy.hero.prove : copy.demo.again}
        </Button>
        {state.phase === 'done' && (
          <Button variant="link" asChild>
            <a href={appHref('mine')}>{copy.demo.keepGoing}</a>
          </Button>
        )}
        <span className="text-2xs text-ink-2">{job ? copy.demo.nothingSent : copy.demo.needsChain}</span>
      </div>
    </div>
  );
}
