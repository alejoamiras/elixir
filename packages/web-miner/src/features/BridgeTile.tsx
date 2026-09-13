// The everyday bridge on the wallet page: the journal while something is crossing (a finished
// crossing fades after a week), "To Ethereum", "Deposit from Ethereum", the recovery file, and the
// portal's standing in one line. Yacana forwards exits by hand: the tile says so and offers the
// forward to the holder — a ready exit, or a held send-ahead once a later version is registered.
import { useAtomValue } from 'jotai';
import { useState } from 'react';
import { type Crossing, visible } from '../../../bridge/src/journal.ts';
import { MAX_RECOVERY_BYTES } from '../../../bridge/src/recovery.ts';
import { PARAMS } from '../../../miner-core/src/generated/params.ts';
import { Button, ExternalLink, Tile, TileHeader } from '../../../ui/src/index.ts';
import { cardLine, type Tone } from '../bridge/copy';
import { l1Links } from '../explorer';
import { duration, amount as fmt, shortAddress } from '../lib/format';
import type { Session } from '../session';
import { type BridgeView, bridgeAtom, journalAtom, nowAtom } from '../state';

const TONE: Record<Tone, string> = {
  quiet: 'text-ink-3',
  busy: 'text-ink-2',
  good: 'text-ok',
  warn: 'text-warn',
  bad: 'text-bad',
};

const OPEN_ENDED = (1n << 256n) - 1n;

/** A held send-ahead may be forwarded by its holder once the Registry names a later version. */
const holderMayForward = (c: Crossing, view: BridgeView): boolean =>
  c.kind === 2 &&
  c.state === 'held' &&
  view.canonical !== undefined &&
  view.canonical.version !== BigInt(c.version);

function Line({
  c,
  now,
  view,
  onForward,
  onRedeem,
}: {
  c: Crossing;
  now: number;
  view: BridgeView;
  onForward: (c: Crossing) => void;
  onRedeem: (c: Crossing) => void;
}) {
  const line = cardLine(
    c,
    Math.floor(now / 1000),
    import.meta.env.VITE_ROLLUP_VERSION,
    view.verdict.kind === 'flipped',
  );
  const l1 = c.l1TxHash ? l1Links.tx(c.l1TxHash) : undefined;
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
        {l1 && c.l1TxHash && (
          <ExternalLink href={l1} full={c.l1TxHash}>
            on Ethereum ↗
          </ExternalLink>
        )}
        {(line.action === 'forward' || holderMayForward(c, view)) && (
          <Button size="sm" variant="link" onClick={() => onForward(c)} data-testid="forward-myself">
            Forward it myself
          </Button>
        )}
        {line.action === 'redeem' && (
          <Button size="sm" variant="link" onClick={() => onRedeem(c)} data-testid="redeem">
            Redeem to Ethereum
          </Button>
        )}
        {c.error && <span className="text-warn">{c.error}</span>}
      </div>
    </li>
  );
}

/** The journal as a file to keep, and a file brought back: a new device, or a browser that lost its storage. */
function RecoveryRow({ session, account }: { session: Session; account: string }) {
  const [note, setNote] = useState<string>();
  const save = async () => {
    try {
      const file = await session.bridge?.exportRecovery();
      if (!file) return;
      const blob = new Blob([JSON.stringify(file, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `yacana-bridge-${file.chainId}-${account.slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(a.href);
      setNote(`${file.crossings.length} crossings saved`);
    } catch (e) {
      setNote(e instanceof Error ? e.message : String(e));
    }
  };
  const restore = async (input: HTMLInputElement) => {
    const f = input.files?.[0];
    input.value = '';
    if (!f) return;
    try {
      if (f.size > MAX_RECOVERY_BYTES) throw new Error('that file is too large to be a recovery file');
      const n = (await session.bridge?.importRecovery(await f.text())) ?? 0;
      setNote(`${n} crossings restored`);
    } catch (e) {
      setNote(e instanceof Error ? e.message : String(e));
    }
  };
  return (
    <div className="mt-3 flex flex-wrap items-center gap-3 text-2xs">
      <Button size="sm" variant="link" onClick={() => void save()} data-testid="recovery-save">
        Save recovery file
      </Button>
      <label className="cursor-pointer text-ink-2 underline underline-offset-3 hover:text-ink">
        Restore from file
        <input
          type="file"
          accept="application/json,.json"
          className="sr-only"
          onChange={(e) => void restore(e.currentTarget)}
          data-testid="recovery-input"
        />
      </label>
      {note && (
        <span className="text-ink-3" data-testid="recovery-note">
          {note}
        </span>
      )}
    </div>
  );
}

const standingLine = (view: BridgeView, now: number): string => {
  if (view.rpcFailing)
    return 'The Ethereum RPC is not answering: the burn would be safe, the rest unknown, so new exits wait.';
  const s = view.standing;
  if (!s) return 'reading the portal…';
  const close =
    s.deadline === OPEN_ENDED
      ? 'stay open'
      : `close ${duration(Math.max(0, Number(s.deadline) - Math.floor(now / 1000)))} from now`;
  return `exit headroom ${fmt(s.headroom, PARAMS.DECIMALS, 0)} ${PARAMS.TOKEN_SYMBOL} · exits from this version ${close}`;
};

export function BridgeTile({
  session,
  account,
  onToEthereum,
  onDeposit,
  onForward,
  onRedeem,
}: {
  session: Session;
  account: string;
  onToEthereum: () => void;
  onDeposit: () => void;
  onForward: (c: Crossing) => void;
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
        <span className="text-xs text-ink-3">{standingLine(view, now)}</span>
      </div>
      {shown.length > 0 && (
        <ul className="mt-3 flex flex-col gap-2" data-testid="journal">
          {shown.map((c) => (
            <Line key={c.id} c={c} now={now} view={view} onForward={onForward} onRedeem={onRedeem} />
          ))}
        </ul>
      )}
      <RecoveryRow session={session} account={account} />
      <p className="mt-3 text-xs text-ink-3">
        Exits are public on Ethereum: the amount and the address. Yacana forwards them by hand; a proven exit
        can be forwarded by anyone at any time.
      </p>
    </Tile>
  );
}
