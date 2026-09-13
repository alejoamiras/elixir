// What arrived for this account, as drawn: one card from wherever it came, "N landed. M on its
// way.", a row per arrival with its own tap, the stations they share, a bar for the count. Sends
// forwarded from an earlier version and deposits from Ethereum, each claimed privately here (about
// 20 s, the fee sponsored). Nothing claims by itself.
import { useAtomValue } from 'jotai';
import { useState } from 'react';
import { type Crossing, destinationOf, visible } from '../../../bridge/src/journal.ts';
import { PARAMS } from '../../../miner-core/src/generated/params.ts';
import { Button, cn, HeroCard, Progress, type TrailItem } from '../../../ui/src/index.ts';
import { cardLine } from '../bridge/copy';
import { amount as fmt } from '../lib/format';
import type { Session } from '../session';
import { journalAtom, nowAtom } from '../state';

const ARRIVING = new Set<Crossing['state']>(['forwarded', 'deposited', 'claimable']);
const money = (raw: bigint) => `${fmt(raw, PARAMS.DECIMALS)} ${PARAMS.TOKEN_SYMBOL}`;

/** Arriving here, landed here lately, or a deposit whose wallet prompt was never answered (the page reloaded under it). */
const shownHere = (c: Crossing, now: number): boolean =>
  destinationOf(c) === import.meta.env.VITE_ROLLUP_VERSION &&
  (ARRIVING.has(c.state) ||
    (c.kind === 3 && c.state === 'proving') ||
    (c.state === 'minted-l2' && visible(c, now)));

const from = (c: Crossing): string => (c.kind === 3 ? 'Ethereum' : `Aztec V${c.version}`);

const dotOf = (c: Crossing): string =>
  c.state === 'minted-l2'
    ? 'bg-ok'
    : c.state === 'claimable' || c.state === 'forwarded'
      ? 'bg-uv'
      : 'bg-ink-4';

/** The row's right side: the tap when it is claimable, the wallet prompt again when it never answered, its word otherwise. */
function Right({
  c,
  word,
  action,
  busy,
  onClaim,
  onResume,
}: {
  c: Crossing;
  word: string;
  action: string | undefined;
  busy: string | undefined;
  onClaim: (c: Crossing) => void;
  onResume?: (c: Crossing) => void;
}) {
  if (action === 'send-again')
    return (
      <Button size="sm" onClick={() => onResume?.(c)} data-testid="arrival-resume">
        Deposit again
      </Button>
    );
  if (c.state === 'claimable')
    return (
      <Button
        size="sm"
        variant="uv"
        disabled={busy !== undefined}
        onClick={() => onClaim(c)}
        data-testid="arrival-claim"
      >
        {busy === c.id ? 'Claiming…' : 'Claim'}
      </Button>
    );
  const landedIn =
    c.state === 'minted-l2' && c.claimBlock ? `✓ block ${c.claimBlock.toLocaleString('en-US')}` : word;
  return (
    <span className="whitespace-nowrap font-mono text-2xs text-ink-3" data-testid="arrival-state">
      {landedIn}
    </span>
  );
}

function Row({
  c,
  now,
  busy,
  onClaim,
  onResume,
}: {
  c: Crossing;
  now: number;
  busy: string | undefined;
  onClaim: (c: Crossing) => void;
  onResume?: (c: Crossing) => void;
}) {
  const line = cardLine(c, Math.floor(now / 1000), c.version);
  const landed = c.state === 'minted-l2';
  return (
    <li
      className="flex items-center justify-between gap-3 text-sm"
      data-testid="arrival"
      data-state={c.state}
    >
      <span className="flex min-w-0 items-baseline gap-2.5">
        <i aria-hidden className={cn('inline-block size-[5px] shrink-0 translate-y-[-1px]', dotOf(c))} />
        <span className="min-w-0">
          <span className={landed ? 'text-ink-2' : 'text-ink'}>
            {money(BigInt(c.amount))} · {landed ? 'minted here, privately' : line.sentence}
          </span>
          <span className="block text-xs text-ink-3">from {from(c)}</span>
        </span>
      </span>
      <Right c={c} word={line.word} action={line.action} busy={busy} onClaim={onClaim} onResume={onResume} />
    </li>
  );
}

const sum = (cs: Crossing[]) => cs.reduce((a, c) => a + BigInt(c.amount), 0n);

export function ArrivalCard({ session, onResume }: { session: Session; onResume?: (c: Crossing) => void }) {
  const journal = useAtomValue(journalAtom);
  const now = useAtomValue(nowAtom);
  const [busy, setBusy] = useState<string>();
  const [error, setError] = useState<string>();
  const arrivals = journal.filter((c) => shownHere(c, now));
  if (arrivals.length === 0) return null;
  const claim = async (c: Crossing) => {
    setBusy(c.id);
    setError(undefined);
    try {
      await session.bridge?.claim(c);
    } catch (e) {
      setError(e instanceof Error ? (e.message.split('\n')[0] ?? '') : String(e));
    } finally {
      setBusy(undefined);
    }
  };
  const landed = arrivals.filter((c) => c.state === 'minted-l2');
  const onWay = arrivals.filter((c) => c.state !== 'minted-l2');
  const forwarded = onWay.every((c) => c.state === 'claimable' || c.state === 'forwarded');
  const sources = [...new Set(arrivals.map(from))].join(' and ');
  const title =
    onWay.length === 0
      ? `${money(sum(landed))} landed.`
      : landed.length === 0
        ? `${money(sum(onWay))} on its way.`
        : `${money(sum(landed))} landed. ${money(sum(onWay))} on its way.`;
  const trail: TrailItem[] = [
    { label: `left ${sources}`, state: 'done' },
    { label: 'proven to Ethereum', state: 'done' },
    { label: `forwarded to V${import.meta.env.VITE_ROLLUP_VERSION}`, state: forwarded ? 'done' : 'on' },
    onWay.length === 0
      ? { label: 'landed', state: 'done' }
      : { label: `landing · ${onWay.length} of ${arrivals.length} left`, state: 'on' },
  ];
  return (
    <HeroCard
      eyebrow={`from ${sources} · this account · fees sponsored`}
      title={title}
      trail={trail}
      tone={onWay.length === 0 ? 'ok' : 'uv'}
      side={
        <>
          <span className="font-mono text-2xs text-ink-2">
            {onWay.length === 0 ? 'nothing to press' : 'each lands with a tap'}
          </span>
          <Progress className="w-full md:w-[240px]" value={(100 * landed.length) / arrivals.length} />
          {error && (
            <span className="text-xs text-warn" data-testid="arrival-error">
              {error}
            </span>
          )}
        </>
      }
      data-testid="arrival-card"
    >
      {onWay.length === 0
        ? 'Every send landed in this account, privately.'
        : 'These are yours on this version: each claims privately on a tap, about 20 s, the fee sponsored.'}
      <ul className="mt-3 flex flex-col gap-2">
        {arrivals.map((c) => (
          <Row key={c.id} c={c} now={now} busy={busy} onClaim={(x) => void claim(x)} onResume={onResume} />
        ))}
      </ul>
    </HeroCard>
  );
}
