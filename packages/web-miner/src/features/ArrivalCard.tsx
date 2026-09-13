// What arrived for this account and waits for a tap: send-aheads forwarded from an earlier version
// and deposits from Ethereum, each claimed privately here (about 20 s, the fee sponsored). Nothing
// claims by itself.
import { useAtomValue } from 'jotai';
import { useState } from 'react';
import type { Crossing } from '../../../bridge/src/journal.ts';
import { PARAMS } from '../../../miner-core/src/generated/params.ts';
import { Button, Tile, TileHeader } from '../../../ui/src/index.ts';
import { cardLine } from '../bridge/copy';
import { amount as fmt } from '../lib/format';
import type { Session } from '../session';
import { journalAtom, nowAtom } from '../state';

const ARRIVING = new Set<Crossing['state']>(['forwarded', 'deposited', 'claimable']);

/** Arriving, or a deposit whose wallet prompt was never answered (the page reloaded under it). */
const shownHere = (c: Crossing): boolean => ARRIVING.has(c.state) || (c.kind === 3 && c.state === 'proving');

export function ArrivalCard({ session, onResume }: { session: Session; onResume?: (c: Crossing) => void }) {
  const journal = useAtomValue(journalAtom);
  const now = useAtomValue(nowAtom);
  const [busy, setBusy] = useState<string>();
  const [error, setError] = useState<string>();
  const arrivals = journal.filter(shownHere);
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
  const version = import.meta.env.VITE_ROLLUP_VERSION;
  return (
    <Tile data-testid="arrival-card">
      <TileHeader aside={`${arrivals.length} waiting`}>arriving</TileHeader>
      <p className="text-xs text-ink-2">
        These are yours on this version: each claims privately, about 20 s, the fee sponsored.
      </p>
      <ul className="mt-3 flex flex-col gap-2">
        {arrivals.map((c) => {
          const line = cardLine(c, Math.floor(now / 1000), version);
          return (
            <li
              key={c.id}
              className="flex items-center justify-between gap-3 rounded-[8px] border border-line-2 px-3.5 py-2.5"
              data-testid="arrival"
              data-state={c.state}
            >
              <div className="min-w-0">
                <div className="font-mono text-sm">
                  {fmt(BigInt(c.amount), PARAMS.DECIMALS)} {PARAMS.TOKEN_SYMBOL}
                  <span className="text-2xs text-ink-3">
                    {' '}
                    · {c.kind === 3 ? 'from Ethereum' : `sent ahead from V${c.version}`}
                  </span>
                </div>
                <div className="mt-0.5 text-xs text-ink-2">{line.sentence}</div>
              </div>
              {line.action === 'send-again' ? (
                <Button size="sm" onClick={() => onResume?.(c)} data-testid="arrival-resume">
                  Deposit again
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant="uv"
                  disabled={c.state !== 'claimable' || busy !== undefined}
                  onClick={() => void claim(c)}
                  data-testid="arrival-claim"
                >
                  {busy === c.id ? 'Claiming…' : c.state === 'claimable' ? 'Claim' : line.word}
                </Button>
              )}
            </li>
          );
        })}
      </ul>
      {error && (
        <p className="mt-2 text-xs text-warn" data-testid="arrival-error">
          {error}
        </p>
      )}
    </Tile>
  );
}
