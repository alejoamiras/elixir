// Mainnet's launch week: the hero is the lottery. Countdown to launch_at from genesis, the reveals
// so far from the lottery slots, one button that links the commit command.
import { Button, Kpi, shortHash } from '../../../ui/src/index.ts';
import { copy, LINKS } from '../copy';
import { useNow } from '../hooks';
import type { LaunchStatus } from '../state';

const pad = (n: number) => String(n).padStart(2, '0');

/** "23:14:08", or the days in front when there are any. */
export const countdown = (seconds: number): string => {
  const s = Math.max(0, seconds);
  const days = Math.floor(s / 86_400);
  const rest = `${pad(Math.floor((s % 86_400) / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
  return days > 0 ? `${days} d ${rest}` : rest;
};

export function Launch({ status, open }: { status: LaunchStatus; open: number | undefined }) {
  const now = useNow();
  const l = copy.launch;
  const launch = status.phase === 'ready' ? status.launch : undefined;
  const until = launch ? launch.genesis.launchAt - now : null;
  const opened = open !== undefined && open >= 0 && until !== null && until <= 0;
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
          label={opened ? l.open : l.opensIn}
          value={
            <span data-testid="launch-countdown">
              {until === null ? '—' : opened ? `epoch ${open}` : countdown(until)}
            </span>
          }
          size="lg"
          sub={
            launch
              ? `launch at ${new Date(launch.genesis.launchAt * 1000).toISOString().slice(0, 16).replace('T', ' ')} UTC`
              : copy.live.loading
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
