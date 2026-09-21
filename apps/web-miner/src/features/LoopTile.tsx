import { PARAMS } from '@yacana/miner-core/generated/params';
import { difficulty, nextWinSeconds, proofsPerMinute } from '@yacana/miner-core/metrics';
import {
  Button,
  ClaimChip,
  cn,
  Kpi,
  Mark,
  Popover,
  PopoverContent,
  PopoverTrigger,
  ScoreLoop,
  StatusPill,
  Tile,
  TileHeader,
  Tip,
  useTweenedNumber,
} from '@yacana/ui';
import { Provider, useAtomValue, useSetAtom, useStore } from 'jotai';
import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { MinerController } from '../controller';
import { chipStep } from '../lib/claim-copy';
import { amount, compact, durationParts } from '../lib/format';
import type { MinerState } from '../lib/reducer';
import { pillStatus } from '../lib/status';
import { openPip, pipSupported } from '../pip';
import { prestoAtom } from '../presto';
import { useSettings } from '../settings';
import { bootAtom, epochAtom, mineIntentAtom, minerAtom, nowAtom, signInAtom } from '../state';

/** The user's Start goes through the session (it asks Presto beside the start); the controller alone stops. */
type Controls = { controller: () => MinerController | undefined; onStart: () => void };

/** The window the header names: since the start until it is three minutes old, then the last three minutes. */
const WINDOW_MS = 180_000;

/** The mini window: the state and Stop, the last minute of the loop as a strip, then rate · epoch · wins. */
export function PipView({ controller, onStart, win }: Controls & { win: Window }) {
  const miner = useAtomValue(minerAtom);
  const epoch = useAtomValue(epochAtom);
  const now = useAtomValue(nowAtom);
  const native = useAtomValue(prestoAtom).active === 'presto';
  const perMinute = useTweenedNumber(proofsPerMinute(miner.recent));
  const bar = epoch ? difficulty(epoch.target) : null;
  return (
    <div className="flex h-full flex-col justify-between bg-ground p-3 text-ink">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-2">
          <Mark state={miner.phase === 'mining' ? 'mining' : 'idle'} />
          <StatusPill status={pillStatus(miner, now)} />
        </span>
        {miner.phase === 'mining' ? (
          <Button size="sm" onClick={() => controller()?.stop()}>
            Stop
          </Button>
        ) : (
          <Button size="sm" variant="primary" disabled={miner.phase !== 'idle'} onClick={onStart}>
            Start
          </Button>
        )}
      </div>
      <ScoreLoop
        calm
        difficulty={bar}
        samples={miner.samples}
        spans={miner.claimSpans}
        winAt={miner.winAt}
        height={48}
        spanMs={60_000}
        geometry={{ pad: 4, fontPx: 10 }}
        win={win}
      />
      <div className="flex items-baseline justify-between gap-2 whitespace-nowrap font-mono text-[10px] text-ink-2">
        <span>
          <span className="font-sans text-lg font-semibold tracking-[-0.02em] text-ink">
            {perMinute.toFixed(1)}
          </span>{' '}
          proofs/min{native && <span className="text-uv-2"> · native</span>}
        </span>
        {epoch && (
          <span>
            epoch {epoch.epoch.toString()} · <span className="text-ink">{epoch.claims}</span> of {PARAMS.N} ·{' '}
            <Tip tip="The score a proof must reach to win." container={win.document.body}>
              bar
            </Tip>{' '}
            {bar === null ? '—' : bar.toFixed(1)}
          </span>
        )}
        <span className="text-ok">
          {miner.wins} {miner.wins === 1 ? 'win' : 'wins'} ·{' '}
          {amount(PARAMS.REWARD * BigInt(miner.wins), PARAMS.DECIMALS)} {PARAMS.TOKEN_SYMBOL}
        </span>
      </div>
    </div>
  );
}

function PopOut({ controller, onStart }: Controls) {
  const store = useStore();
  const [pip, setPip] = useState<Window | null>(null);
  useEffect(() => {
    if (!pip) return;
    const root = createRoot(pip.document.body);
    root.render(
      <Provider store={store}>
        <PipView controller={controller} onStart={onStart} win={pip} />
      </Provider>,
    );
    const onHide = () => setPip(null);
    pip.addEventListener('pagehide', onHide);
    return () => {
      pip.removeEventListener('pagehide', onHide);
      root.unmount();
      pip.close();
    };
  }, [pip, store, controller, onStart]);
  return (
    <Button
      size="sm"
      disabled={pip !== null}
      onClick={() => void openPip().then(setPip)}
      data-testid="pop-out"
    >
      Pop out
    </Button>
  );
}

/** Start's place: opening while an account comes up, the way in while none is, Stop/Start otherwise. */
function StartControl({
  ready,
  opening,
  miner,
  controller,
  onStart,
}: Controls & { ready: boolean; opening: boolean; miner: MinerState }) {
  const openSignIn = useSetAtom(signInAtom);
  const setIntent = useSetAtom(mineIntentAtom);
  if (opening)
    return (
      <Button size="sm" variant="primary" disabled data-testid="start-opening">
        opening…
      </Button>
    );
  if (!ready)
    return (
      <Button
        size="sm"
        variant="primary"
        data-testid="sign-in-mine"
        onClick={() => {
          setIntent(true);
          openSignIn(true);
          // Start mining is the one moment Presto is asked: with no account yet, only the probe runs.
          onStart();
        }}
      >
        Start mining
      </Button>
    );
  if (miner.phase === 'mining' || miner.phase === 'claiming')
    return (
      <Button
        size="sm"
        data-testid="stop"
        disabled={miner.stopping}
        title={
          miner.phase === 'claiming' ? 'The claim finishes; mining does not resume after it.' : undefined
        }
        onClick={() => controller()?.stop()}
      >
        Stop
      </Button>
    );
  return (
    <Button
      size="sm"
      variant="primary"
      data-testid="start"
      disabled={miner.phase !== 'idle' || miner.proverDead}
      onClick={onStart}
    >
      Start mining
    </Button>
  );
}

function LoopHelp({ bar }: { bar: number | null }) {
  const odds = bar === null ? null : Math.round(bar);
  return (
    <Popover>
      <PopoverTrigger
        aria-label="How to read this"
        data-testid="loop-help"
        className="inline-flex size-[18px] items-center justify-center rounded-full border border-line-2 font-mono text-[11px] font-medium normal-case tracking-normal text-ink-3 outline-none hover:border-ink-4 hover:text-ink focus-visible:ring-2 focus-visible:ring-ring/50 data-[state=open]:text-ink"
      >
        ?
      </PopoverTrigger>
      <PopoverContent className="normal-case tracking-normal" data-testid="loop-help-content">
        <b className="font-semibold text-ink">How to read this</b>
        <span>
          Each tick is one proof. Its height is its <b className="font-medium text-ink">score</b>: pure luck,
          a score of S comes up about once in S proofs.
        </span>
        <span>
          A proof that reaches <b className="font-medium text-uv-2">the bar</b> wins{' '}
          {amount(PARAMS.REWARD, PARAMS.DECIMALS)} {PARAMS.TOKEN_SYMBOL}.
          {odds !== null && odds >= 2 ? ` Today about 1 proof in ${odds} does, so most ticks stay low.` : ''}{' '}
          More proofs per minute means more draws, not taller ones.
        </span>
      </PopoverContent>
    </Popover>
  );
}

/** The header's left: the pill when paused; "live · since 16:05" then "live · last 3 min" while mining; else "your proofs". */
function HeaderText({
  status,
  miner,
  now,
}: {
  status: ReturnType<typeof pillStatus>;
  miner: MinerState;
  now: number;
}) {
  if (status === 'paused') return <StatusPill status="paused" />;
  if (miner.phase === 'mining' || miner.phase === 'claiming') {
    const since = miner.since;
    const window =
      since === null || now - since >= WINDOW_MS
        ? 'last 3 min'
        : `since ${new Date(since).toISOString().slice(11, 16)}`;
    return <span data-testid="loop-window">live · {window}</span>;
  }
  return <>your proofs</>;
}

/** The claim's step and one clock from the win, beside the status; the wait once Stop was pressed. */
function HeaderClaim({ miner, now }: { miner: MinerState; now: number }) {
  if (!miner.claim) return null;
  return (
    <ClaimChip
      step={chipStep(miner.claim.step)}
      seconds={(now - miner.claim.wonAt) / 1000}
      stopping={miner.stopping}
      data-testid="claim-chip"
    />
  );
}

/** The chart's footer: the session's pace and count, with ✦ presto between them while Presto is what proves. */
function RateLine({ native, miner, perProof }: { native: boolean; miner: MinerState; perProof: number }) {
  if (!miner.recent.length) return null;
  return (
    <span data-testid="rate-line">
      {perProof.toFixed(1)} s per proof · {native && <span className="text-uv-2">✦ presto · </span>}
      {compact(miner.proofs)} proofs
    </span>
  );
}

/** What reaching the bar means, and how often a proof does: a score of S comes up about once in S proofs. */
export const barCaption = (bar: number | null): string | undefined => {
  if (bar === null) return undefined;
  const odds = Math.round(bar);
  return odds < 2
    ? 'the bar · reach it and you win'
    : `the bar · reach it and you win · about 1 in ${odds} do`;
};

/** The header row is a fixed-height status line with the claim's chip; the stepper lives in the rail. */
export function LoopTile({ controller, onStart, className }: Controls & { className?: string }) {
  const boot = useAtomValue(bootAtom);
  const miner = useAtomValue(minerAtom);
  const epoch = useAtomValue(epochAtom);
  const now = useAtomValue(nowAtom);
  const native = useAtomValue(prestoAtom).active === 'presto';
  const [settings] = useSettings();
  const last = miner.recent[miner.recent.length - 1];
  const perProof = useTweenedNumber(last === undefined ? 0 : last / 1000);
  const ready = boot.phase === 'ready';
  const opening = boot.phase === 'opening';
  const bar = epoch ? difficulty(epoch.target) : null;
  const status = pillStatus(miner, now);
  return (
    <Tile className={cn('flex flex-col gap-4', className)}>
      <TileHeader
        className="mb-0 h-[30px] items-center"
        aside={
          <span className="flex items-center gap-3">
            {settings.pip && pipSupported() && <PopOut controller={controller} onStart={onStart} />}
            <StartControl
              ready={ready}
              opening={opening}
              miner={miner}
              controller={controller}
              onStart={onStart}
            />
          </span>
        }
      >
        <span className="flex items-center gap-3">
          <HeaderText status={status} miner={miner} now={now} />
          <LoopHelp bar={bar} />
          <HeaderClaim miner={miner} now={now} />
        </span>
      </TileHeader>
      <ScoreLoop
        calm
        difficulty={bar}
        samples={miner.samples}
        spans={miner.claimSpans}
        axisTitle="score · log scale"
        barCaption={barCaption(bar)}
        winAt={miner.winAt}
        since={miner.sinceT ?? undefined}
        height={230}
        placeholder={[
          'Your proofs draw here once you start.',
          `The bar is ${bar === null ? '—' : bar.toFixed(1)} · clear it to win`,
        ]}
        footer={<RateLine native={native} miner={miner} perProof={perProof} />}
      />
    </Tile>
  );
}

const nextWin = (target: bigint, perMinute: number): [string, string] | null => {
  if (perMinute <= 0) return null;
  const [value, unit] = durationParts(nextWinSeconds(target, perMinute));
  return unit ? [`~${value}`, unit] : null;
};

/** Signed out the values are dashes and the subs say what would fill them. */
function kpiSubs(
  ready: boolean,
  hasEpoch: boolean,
  bar: number,
  miner: MinerState,
): { rate: string; next: string; best: string } {
  if (ready)
    return {
      rate: `${compact(miner.proofs)} proofs this session`,
      next: 'could be now, could be 3× longer',
      best: `${miner.wins} ${miner.wins === 1 ? 'win' : 'wins'} · ${amount(PARAMS.REWARD * BigInt(miner.wins), PARAMS.DECIMALS)} ${PARAMS.TOKEN_SYMBOL} this session`,
    };
  const perWin = Math.max(1, Math.round(bar));
  return {
    rate: 'starts with mining',
    next: hasEpoch
      ? `the bar is ${bar.toFixed(1)} · about ${perWin} ${perWin === 1 ? 'proof' : 'proofs'} per win`
      : 'the bar is not read yet',
    best: '',
  };
}

export function KpiTiles({ className }: { className?: string }) {
  const miner = useAtomValue(minerAtom);
  const epoch = useAtomValue(epochAtom);
  const ready = useAtomValue(bootAtom).phase === 'ready';
  const perMinute = useTweenedNumber(proofsPerMinute(miner.recent));
  const bar = epoch ? difficulty(epoch.target) : 1;
  const next = ready && epoch ? nextWin(epoch.target, proofsPerMinute(miner.recent)) : null;
  const subs = kpiSubs(ready, epoch !== null, bar, miner);
  return (
    <div className={cn('grid grid-cols-3 gap-[14px]', className)} data-testid="kpi-tiles">
      <Tile>
        <Kpi
          size="lg"
          label="rate"
          value={<span data-testid="rate">{ready ? perMinute.toFixed(1) : '—'}</span>}
          unit="proofs/min"
          sub={
            ready ? (
              <>
                <span data-testid="tickets">{compact(miner.proofs)}</span> proofs this session
              </>
            ) : (
              subs.rate
            )
          }
        />
      </Tile>
      <Tile>
        <Kpi
          size="lg"
          label="next win, at this rate"
          value={next ? next[0] : '—'}
          unit={next?.[1]}
          sub={subs.next}
        />
      </Tile>
      <Tile>
        <Kpi
          size="lg"
          label="best this epoch"
          value={ready && miner.best !== null ? miner.best.toFixed(1) : '—'}
          unit={ready && epoch ? `of ${bar.toFixed(1)}` : undefined}
          sub={subs.best || undefined}
        />
      </Tile>
    </div>
  );
}
