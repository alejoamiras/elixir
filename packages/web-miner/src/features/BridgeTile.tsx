// The everyday bridge on the wallet page: a journal card per crossing while something is
// crossing (a finished one fades after a week), each with its stations, its line and its offers;
// "nothing crossing" otherwise; under it the deposit and the recovery file, and the contracts on
// Ethereum. Yacana forwards exits by hand: the tile says so and offers the forward to the holder —
// a ready exit, or a held send-ahead once a later version is registered.
import { useAtomValue } from 'jotai';
import { useState } from 'react';
import { type Crossing, visible } from '../../../bridge/src/journal.ts';
import { MAX_RECOVERY_BYTES } from '../../../bridge/src/recovery.ts';
import { PARAMS } from '../../../miner-core/src/generated/params.ts';
import { Button, ExternalLink, JournalCard, Tile, TileHeader } from '../../../ui/src/index.ts';
import { cardLine, chainName, journalTone, stamp, type Tone, trailOf, whoOf } from '../bridge/copy';
import { bridgeRecord, isOldRole, versionNameOf } from '../bridge/env';
import { l1Links } from '../explorer';
import { duration, amount as fmt, shortAddress } from '../lib/format';
import type { Session } from '../session';
import { type BridgeView, bridgeAtom, journalAtom, nowAtom } from '../state';
import { saveRecoveryFile } from './recovery';

const TONE: Record<Tone, string> = {
  quiet: 'text-ink-3',
  busy: 'text-ink-2',
  good: 'text-ok',
  warn: 'text-warn',
  bad: 'text-bad',
};

const OPEN_ENDED = (1n << 256n) - 1n;

/** A held send-ahead is forwarded from the version it lands on: the live one, never the old origin. */
const holderMayForward = (c: Crossing, view: BridgeView): boolean =>
  c.kind === 2 &&
  c.state === 'held' &&
  !isOldRole() &&
  view.canonical !== undefined &&
  view.canonical.version !== BigInt(c.version) &&
  view.canonical.version === BigInt(import.meta.env.VITE_ROLLUP_VERSION);

function Card({
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
  // The crossing's own version, not the build's: a V5 send viewed on V6 waits for V5's proof, under V5's frozen cap.
  const flipped = view.canonical !== undefined && view.canonical.version !== BigInt(c.version);
  const own = versionNameOf(c.version, view.canonical);
  const target = versionNameOf(c.target, view.canonical);
  const line = cardLine(c, Math.floor(now / 1000), own, flipped, target);
  const l1 = c.l1TxHash ? l1Links.tx(c.l1TxHash) : undefined;
  const forward = line.action === 'forward' || holderMayForward(c, view);
  const actions =
    l1 || forward || line.action === 'redeem' || c.error ? (
      <>
        {l1 && c.l1TxHash && (
          <ExternalLink href={l1} full={c.l1TxHash}>
            Etherscan
          </ExternalLink>
        )}
        {forward && (
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
      </>
    ) : undefined;
  return (
    <JournalCard
      amount={fmt(BigInt(c.amount), PARAMS.DECIMALS)}
      unit={PARAMS.TOKEN_SYMBOL}
      who={whoOf(c, shortAddress, target)}
      when={
        <>
          <span className={TONE[line.tone]} data-testid="crossing-word">
            {line.word}
          </span>
          {' · '}
          {stamp(c.createdAt)}
        </>
      }
      trail={trailOf(c, target)}
      line={line.sentence}
      actions={actions}
      tone={journalTone(line.tone)}
      data-testid="crossing"
      data-state={c.state}
      data-kind={c.kind}
    />
  );
}

/** The journal as a file to keep, and a file brought back: a new device, or a browser that lost its storage. */
function Recovery({ session, account }: { session: Session; account: string }) {
  const [note, setNote] = useState<string>();
  const save = async () => {
    try {
      setNote(await saveRecoveryFile(session, account));
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
    <>
      <Button
        size="sm"
        variant="link"
        className="text-ink-2"
        onClick={() => void save()}
        data-testid="recovery-save"
      >
        Save a recovery file ⤓
      </Button>
      <label className="cursor-pointer text-ink-2 underline underline-offset-3 hover:text-ink">
        Restore an exit from its file
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
    </>
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
  return `exit headroom ${fmt(s.headroom, PARAMS.DECIMALS, 0)} ${PARAMS.TOKEN_SYMBOL} · exits from this version ${close} · Yacana forwards exits by hand; a proven exit can be forwarded by anyone, any time`;
};

const asideOf = (view: BridgeView): string => {
  const chain = chainName(bridgeRecord()?.chainId);
  if (view.rpcFailing) return `${chain} · Ethereum RPC silent`;
  if (view.standing?.paused) return `${chain} · paused`;
  return `${chain} · forwarded by hand`;
};

export function BridgeTile({
  session,
  account,
  onForward,
  onRedeem,
}: {
  session: Session;
  account: string;
  onForward: (c: Crossing) => void;
  onRedeem: (c: Crossing) => void;
}) {
  const journal = useAtomValue(journalAtom);
  const view = useAtomValue(bridgeAtom);
  const now = useAtomValue(nowAtom);
  const record = bridgeRecord();
  const shown = journal.filter(
    (c) => visible(c, now) && c.kind !== 3 && c.state !== 'claimable' && c.state !== 'minted-l2',
  );
  return (
    <Tile className="md:col-span-2" data-testid="bridge-tile">
      <TileHeader aside={asideOf(view)}>bridge</TileHeader>
      {shown.length > 0 ? (
        <ul className="m-0 flex list-none flex-col gap-2.5 p-0" data-testid="journal">
          {shown.map((c) => (
            <Card key={c.id} c={c} now={now} view={view} onForward={onForward} onRedeem={onRedeem} />
          ))}
        </ul>
      ) : (
        <div
          className="rounded-[8px] border border-dashed border-line-2 px-4 py-[18px] text-center"
          data-testid="nothing-crossing"
        >
          <span className="label-mono">nothing crossing</span>
          <p className="mt-1.5 text-xs text-ink-3">
            Withdrawals to Ethereum, deposits from it and moves to the next Aztec version show here, with
            where they are.
          </p>
        </div>
      )}
      <p className="mt-3 text-xs text-ink-3" data-testid="bridge-standing">
        {standingLine(view, now)}
      </p>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-line pt-3 text-xs">
        <span className="flex flex-wrap items-center gap-4">
          <Recovery session={session} account={account} />
        </span>
        {record && (
          <span className="font-mono text-2xs text-ink-3">
            YACA on {chainName(record.chainId)}:{' '}
            <ExternalLink href={l1Links.address(record.yaca)} full={record.yaca}>
              {shortAddress(record.yaca)}
            </ExternalLink>
            {' · portal '}
            <ExternalLink href={l1Links.address(record.portal)} full={record.portal}>
              {shortAddress(record.portal)}
            </ExternalLink>
          </span>
        )}
      </div>
    </Tile>
  );
}
