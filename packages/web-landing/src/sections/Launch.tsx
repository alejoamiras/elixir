// Mainnet's launch week: the hero is the lottery. The countdown follows the contract's phases
// (commit until launch_at, reveal for REVEAL_WINDOW_SECONDS, then anyone's launch() opens epoch 0),
// the reveals so far come from the lottery slots, one button links the commit command.
import { PARAMS } from '../../../miner-core/src/generated/params.ts';
import { Button, Kpi, shortHash } from '../../../ui/src/index.ts';
import { copy, LINKS } from '../copy';
import { useNow } from '../hooks';
import type { LaunchStatus, LiveStatus } from '../state';

const pad = (n: number) => String(n).padStart(2, '0');

/** "23:14:08", or the days in front when there are any. */
export const countdown = (seconds: number): string => {
  const s = Math.max(0, seconds);
  const days = Math.floor(s / 86_400);
  const rest = `${pad(Math.floor((s % 86_400) / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
  return days > 0 ? `${days} d ${rest}` : rest;
};

export type LaunchPhase = 'commit' | 'reveal' | 'launch' | 'open';

/** `open` only once epoch 0 exists on chain; the clock alone cannot tell that `launch()` ran. */
export function launchPhase(
  now: number,
  launchAt: number,
  windowSeconds: number,
  launched: boolean,
): LaunchPhase {
  if (launched) return 'open';
  if (now < launchAt) return 'commit';
  if (now < launchAt + windowSeconds) return 'reveal';
  return 'launch';
}

const utc = (unix: number) => `${new Date(unix * 1000).toISOString().slice(0, 16).replace('T', ' ')} UTC`;

export function Launch({ status, live }: { status: LaunchStatus; live: LiveStatus }) {
  const now = useNow();
  const l = copy.launch;
  const launch = status.phase === 'ready' ? status.launch : undefined;
  const window = Number(PARAMS.REVEAL_WINDOW_SECONDS);
  const phase = launch
    ? launchPhase(now, launch.genesis.launchAt, window, live.phase === 'ready')
    : undefined;
  const clock = (): string => {
    if (!launch || !phase) return '—';
    if (phase === 'commit') return countdown(launch.genesis.launchAt - now);
    if (phase === 'reveal') return countdown(launch.genesis.launchAt + window - now);
    if (phase === 'launch') return l.anyone;
    return `epoch ${live.phase === 'ready' ? live.live.open : 0}`;
  };
  return (
    <section
      id="hero"
      className="grid gap-8 py-12 md:grid-cols-2 md:items-center md:py-20"
      data-testid="launch"
    >
      <div className="flex flex-col gap-5">
        <p className="eyebrow">{l.eyebrow}</p>
        <h1 className="text-balance text-4xl font-semibold leading-tight tracking-tight md:text-5xl">
          {copy.hero.headline}
        </h1>
        <p className="text-pretty text-lg text-ink-2">{l.body}</p>
        <div className="flex flex-col gap-1">
          <Button variant="uv" size="lg" className="self-start" asChild>
            <a href={LINKS.launchDocs} data-testid="launch-commit">
              {l.commit}
            </a>
          </Button>
          <span className="text-2xs text-ink-2">{l.commitSub}</span>
        </div>
      </div>
      <div className="flex flex-col gap-4 rounded-md border border-line bg-panel p-4">
        <Kpi
          label={<span data-testid="launch-phase">{phase ? l.phases[phase] : copy.live.loading}</span>}
          value={<span data-testid="launch-countdown">{clock()}</span>}
          size="lg"
          sub={
            launch
              ? `reveals ${utc(launch.genesis.launchAt)} to ${utc(launch.genesis.launchAt + window)}`
              : ''
          }
        />
        <Kpi
          label={l.reveals}
          value={<span data-testid="launch-reveals">{launch ? launch.lottery.reveals : '—'}</span>}
          sub={launch ? `mix ${shortHash(`0x${launch.lottery.mix.toString(16)}`)}` : ''}
        />
      </div>
    </section>
  );
}
