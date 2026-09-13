// The everyday bridge on the wallet page: the journal while something is crossing (a finished
// crossing fades after a week), "To Ethereum", "Deposit from Ethereum", the recovery file, and the
// portal's standing in one line. Yacana forwards exits by hand: the tile says so and offers the
// forward to the holder.
import { useAtomValue } from 'jotai';
import { useState } from 'react';
import { type Crossing, visible } from '../../../bridge/src/journal.ts';
import { PARAMS } from '../../../miner-core/src/generated/params.ts';
import { Button, ExternalLink, Tile, TileHeader } from '../../../ui/src/index.ts';
import { cardLine, type Tone } from '../bridge/copy';
import { l1Links } from '../explorer';
import { duration, amount as fmt, shortAddress } from '../lib/format';
import type { Session } from '../session';
import { bridgeAtom, journalAtom, nowAtom } from '../state';

const TONE: Record<Tone, string> = {
  quiet: 'text-ink-3',
  busy: 'text-ink-2',
  good: 'text-ok',
  warn: 'text-warn',
  bad: 'text-bad',
};

function Line({
  c,
  now,
  session,
  onRedeem,
}: {
  c: Crossing;
  now: number;
  session: Session;
  onRedeem: (c: Crossing) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const line = cardLine(c, Math.floor(now / 1000), import.meta.env.VITE_ROLLUP_VERSION);
  const forward = async () => {
    setBusy(true);
    setError(undefined);
    try {
      await session.bridge?.selfForward(c);
    } catch (e) {
      setError(e instanceof Error ? (e.message.split('\n')[0] ?? '') : String(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <li
      className="rounded-[8px] border border-line-2 px-3.5 py-2.5"
      data-testid="crossing"
      data-state={c.state}
      data-kind={c.kind}
    >
      <div className="flex items-center justify-between gap-3">
        <span className="font-mono text-sm">
          {fmt(BigInt(c.amount), PARAMS.DECIMALS)} {PARAMS.TOKEN_SYMBOL}
          <span className="text-2xs text-ink-3">
            {' · '}
            {c.kind === 1
              ? `to ${shortAddress(c.ethAddress)}`
              : c.kind === 2
                ? 'sent ahead'
                : 'from Ethereum'}
          </span>
        </span>
        <span className={`font-mono text-2xs ${TONE[line.tone]}`} data-testid="crossing-word">
          {line.word}
        </span>
      </div>
      <p className="mt-1 text-xs text-ink-2">{line.sentence}</p>
      <div className="mt-1.5 flex flex-wrap items-center gap-3 text-2xs">
        {c.l1TxHash && l1Links.tx(c.l1TxHash) && (
          <ExternalLink href={l1Links.tx(c.l1TxHash)} full={c.l1TxHash}>
            on Ethereum ↗
          </ExternalLink>
        )}
        {line.action === 'forward' && (
          <Button
            size="sm"
            variant="link"
            disabled={busy}
            onClick={() => void forward()}
            data-testid="forward-myself"
          >
            {busy ? 'Forwarding…' : 'Forward it myself'}
          </Button>
        )}
        {line.action === 'redeem' && (
          <Button size="sm" variant="link" onClick={() => onRedeem(c)} data-testid="redeem">
            Redeem to Ethereum
          </Button>
        )}
        {error && <span className="text-warn">{error}</span>}
      </div>
    </li>
  );
}

export function BridgeTile({
  session,
  onToEthereum,
  onDeposit,
  onRedeem,
}: {
  session: Session;
  onToEthereum: () => void;
  onDeposit: () => void;
  onRedeem: (c: Crossing) => void;
}) {
  const journal = useAtomValue(journalAtom);
  const view = useAtomValue(bridgeAtom);
  const now = useAtomValue(nowAtom);
  const shown = journal.filter(
    (c) => visible(c, now) && c.kind !== 3 && c.state !== 'claimable' && c.state !== 'minted-l2',
  );
  const standing = view.standing;
  return (
    <Tile className="md:col-span-2" data-testid="bridge-tile">
      <TileHeader aside={view.rpcFailing ? 'Ethereum RPC silent' : standing?.paused ? 'paused' : 'Ethereum'}>
        bridge
      </TileHeader>
      <div className="flex flex-wrap items-center gap-3">
        <Button
          variant="primary"
          size="sm"
          disabled={view.rpcFailing || !standing?.registered}
          onClick={onToEthereum}
          data-testid="to-ethereum"
        >
          To Ethereum
        </Button>
        <Button
          variant="ghost"
          size="sm"
          disabled={!standing?.registered || standing.depositsClosed}
          onClick={onDeposit}
          data-testid="deposit"
        >
          Deposit from Ethereum
        </Button>
        <span className="text-xs text-ink-3">
          {view.rpcFailing
            ? 'The Ethereum RPC is not answering: the burn would be safe, the rest unknown, so new exits wait.'
            : standing
              ? `exit headroom ${fmt(standing.headroom, PARAMS.DECIMALS, 0)} ${PARAMS.TOKEN_SYMBOL} · exits from this version ${standing.deadline === (1n << 256n) - 1n ? 'stay open' : `close ${duration(Math.max(0, Number(standing.deadline) - Math.floor(now / 1000)))} from now`}`
              : 'reading the portal…'}
        </span>
      </div>
      {shown.length > 0 && (
        <ul className="mt-3 flex flex-col gap-2" data-testid="journal">
          {shown.map((c) => (
            <Line key={c.id} c={c} now={now} session={session} onRedeem={onRedeem} />
          ))}
        </ul>
      )}
      <p className="mt-3 text-xs text-ink-3">
        Exits are public on Ethereum: the amount and the address. Yacana forwards them by hand; a proven exit
        can be forwarded by anyone at any time.
      </p>
    </Tile>
  );
}
