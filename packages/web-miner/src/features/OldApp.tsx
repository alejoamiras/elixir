// The versioned origin's one page (the `old` role), as drawn: this version has ended; what is
// still here can leave — send it ahead, or to Ethereum — while the version proves. Signed out, the
// way in; signed in, the balance and the one button; once something was sent, its stations; once
// the version no longer proves, what is lost and what was safe. Nothing is mined here, and no
// account is created here.
import { useAtomValue, useSetAtom } from 'jotai';
import { useState } from 'react';
import { type Crossing, inFlight } from '../../../bridge/src/journal.ts';
import { PARAMS } from '../../../miner-core/src/generated/params.ts';
import { AmountBlock, Button, Kpi, KvRow, Stepper, Tile, TileHeader } from '../../../ui/src/index.ts';
import { amount as fmt } from '../lib/format';
import { navigate } from '../routes';
import type { Session } from '../session';
import { balanceAtom, bootAtom, bridgeAtom, journalAtom, signInAtom } from '../state';
import { BridgeProviders } from './BridgeProviders';
import { SendAheadSheet } from './SendAheadSheet';

const OPEN_ENDED = (1n << 256n) - 1n;
const money = (raw: bigint) => `${fmt(raw, PARAMS.DECIMALS)} ${PARAMS.TOKEN_SYMBOL}`;
const day = (unix: bigint) => new Date(Number(unix) * 1000).toISOString().slice(0, 10);
const hhmm = (unix: string) => new Date(Number(unix) * 1000).toISOString().slice(11, 16);
const apexHost = (): string => {
  try {
    return new URL(
      import.meta.env.VITE_RP_ID.startsWith('http')
        ? import.meta.env.VITE_RP_ID
        : `https://${import.meta.env.VITE_RP_ID}`,
    ).host;
  } catch {
    return 'the live app';
  }
};

type Moment = 'signed-out' | 'still-here' | 'sent' | 'quiet';

/** Signed out → the way in; a send in flight → its stations; exits closed or a send undone with nothing left → quiet; else the balance. */
const momentOf = (ready: boolean, sent: Crossing[], closed: boolean, undone: boolean): Moment => {
  if (!ready) return 'signed-out';
  if (closed || (undone && sent.every((c) => !inFlight(c)))) return 'quiet';
  return sent.some(inFlight) ? 'sent' : 'still-here';
};

function SignedOut() {
  const openSignIn = useSetAtom(signInAtom);
  return (
    <Tile className="flex flex-col gap-3">
      <span className="label-mono">sign in · same passkey or words</span>
      <div>
        <Button variant="uv" size="lg" onClick={() => openSignIn(true)} data-testid="sign-in-mine">
          Open with passkey or words
        </Button>
      </div>
      <p className="text-xs text-ink-3">
        This is another origin, so the passkey asks once and twelve words are typed again. Accounts are
        restored here, not created. Whoever serves this page controls it; run your own build if that matters.
      </p>
    </Tile>
  );
}

function StillHere({ balance, onSendAhead }: { balance: bigint | null; onSendAhead: () => void }) {
  const view = useAtomValue(bridgeAtom);
  return (
    <Tile className="flex flex-col gap-3.5 border-uv">
      <TileHeader aside="private · can leave while this version proves">
        still on V{import.meta.env.VITE_ROLLUP_VERSION}
      </TileHeader>
      <Kpi
        label={<span className="sr-only">balance</span>}
        value={
          <span data-testid="wallet-balance">{balance === null ? '…' : fmt(balance, PARAMS.DECIMALS)}</span>
        }
        unit={PARAMS.TOKEN_SYMBOL}
        size="lg"
      />
      <div className="flex flex-wrap items-center gap-3">
        <Button
          variant="uv"
          size="lg"
          disabled={!balance || view.rpcFailing}
          onClick={onSendAhead}
          data-testid="send-ahead"
        >
          Send {balance ? money(balance) : ''} ahead
        </Button>
        <Button variant="link" className="text-ink-2" onClick={() => navigate('wallet')}>
          or to Ethereum
        </Button>
      </div>
      <p className="text-xs text-ink-3">
        Sent ahead, it lands in this same account at {apexHost()} with a tap, the next time you sign in there.
      </p>
    </Tile>
  );
}

function Sent({ sent }: { sent: Crossing[] }) {
  const live = sent.filter(inFlight);
  const sum = live.reduce((a, c) => a + BigInt(c.amount), 0n);
  const newest = live[live.length - 1] as Crossing;
  const proven = newest.state !== 'proving' && newest.state !== 'sent' && newest.state !== 'proven-pending';
  return (
    <Tile className="flex flex-col gap-3.5 border-ok/40" data-testid="old-sent">
      <TileHeader aside={`${live.length} crossing`}>sent ahead</TileHeader>
      <AmountBlock
        value={fmt(sum, PARAMS.DECIMALS)}
        unit={PARAMS.TOKEN_SYMBOL}
        tone="ok"
        aside={
          <span className="text-ok">
            {newest.block ? `✓ burned in block ${newest.block.toLocaleString('en-US')}` : '✓ burned'}
          </span>
        }
      />
      <Stepper
        steps={[
          { id: 'left', label: 'left this account', state: 'done' },
          {
            id: 'prove',
            label: proven
              ? 'proven to Ethereum'
              : `not yet proven by V${import.meta.env.VITE_ROLLUP_VERSION}`,
            state: proven ? 'done' : 'active',
            right: !proven && newest.proofDeadline ? `by ${hhmm(newest.proofDeadline)}` : undefined,
            detail: proven
              ? undefined
              : 'Lands if the version proves the epoch by then, lost if it stops first.',
          },
          {
            id: 'forward',
            label: 'forwarded to the next version',
            state: proven ? 'active' : 'pending',
            right: 'by hand, or by you',
          },
          {
            id: 'land',
            label: `lands at ${apexHost()} with a tap`,
            state: 'pending',
            detail: 'Same passkey.',
          },
        ]}
      />
      <p className="text-xs text-ink-3">
        You can close this page and watch it at {apexHost()}; the wallet here follows it too.
      </p>
    </Tile>
  );
}

function Quiet({ balance, safe }: { balance: bigint | null; safe: Crossing[] }) {
  return (
    <>
      <Tile className="flex flex-col gap-2.5 opacity-55 saturate-[.4]" data-testid="old-quiet">
        <TileHeader aside="lost">still on V{import.meta.env.VITE_ROLLUP_VERSION}</TileHeader>
        <Kpi
          label={<span className="sr-only">balance</span>}
          value={balance === null ? '…' : fmt(balance, PARAMS.DECIMALS)}
          unit={PARAMS.TOKEN_SYMBOL}
          size="lg"
          sub="cannot leave"
        />
      </Tile>
      {safe.length > 0 && (
        <Tile className="flex flex-col gap-2.5 border-ok/40">
          <TileHeader>proven in time · safe</TileHeader>
          {safe.map((c) => (
            <KvRow
              key={c.id}
              label={`${money(BigInt(c.amount))} · sent ahead`}
              value={
                <span className="text-ok">
                  {c.state === 'minted-l2' ? 'arrived on the next version' : 'held on Ethereum'}
                </span>
              }
            />
          ))}
        </Tile>
      )}
    </>
  );
}

export function OldApp({ session }: { session?: Session }) {
  const boot = useAtomValue(bootAtom);
  const view = useAtomValue(bridgeAtom);
  const journal = useAtomValue(journalAtom);
  const balance = useAtomValue(balanceAtom);
  const [ahead, setAhead] = useState(false);
  const version = import.meta.env.VITE_ROLLUP_VERSION;
  const sent = journal.filter((c) => c.kind === 2 && c.version === version && c.state !== 'dropped');
  const closed =
    view.standing !== undefined &&
    view.standing.deadline !== OPEN_ENDED &&
    BigInt(Math.floor(Date.now() / 1000)) > view.standing.deadline;
  const undone = sent.some((c) => c.state === 'never-proven');
  const m = momentOf(boot.phase === 'ready', sent, closed, undone);
  const flipDay = view.standing && view.standing.flipAt > 0n ? day(view.standing.flipAt) : undefined;
  const safe = sent.filter(
    (c) =>
      c.state === 'held' ||
      c.state === 'forwarded' ||
      c.state === 'claimable' ||
      c.state === 'minted-l2' ||
      c.state === 'not-registered',
  );
  return (
    <div className="mx-auto flex max-w-[640px] flex-col gap-[22px] px-5 py-14" data-testid="cockpit">
      <div data-testid="retired">
        <span className="label-mono">
          aztec v{version} · {m === 'quiet' ? 'quiet' : 'retired'}
          {flipDay ? ` ${flipDay}` : ''}
        </span>
        <h1 className="mt-2 text-balance text-[36px] font-semibold leading-[1.05] tracking-[-0.025em]">
          {m === 'quiet'
            ? `V${version} no longer proves. Nothing can leave.`
            : 'Send what is still here ahead.'}
        </h1>
        <p className="mt-3 text-pretty text-base leading-[1.55] text-ink-2 [&_b]:font-medium [&_b]:text-ink">
          {m === 'quiet' ? (
            <>
              Mining has ended on this version and V{version} stopped proving epochs. Balances still here
              cannot leave any more, and sends in epochs it never proved were undone back onto it:{' '}
              <b>they are lost</b>. Sends proven to Ethereum in time are safe and arrive at {apexHost()}.
            </>
          ) : (
            <>
              Mining has ended on this version. Yacana lives at <b>{apexHost()}</b> now; this is the old app,
              kept open so your balance can leave: send ahead to the next version, or to Ethereum, from the
              wallet. Sending it ahead now is a bet that V{version} proves one more epoch; leaving it is a
              sure loss. Anything still on V{version} when it goes quiet is lost — it goes quiet after the
              upgrade, without notice.
            </>
          )}
        </p>
      </div>
      {m === 'signed-out' && <SignedOut />}
      {m === 'still-here' && <StillHere balance={balance} onSendAhead={() => setAhead(true)} />}
      {m === 'sent' && <Sent sent={sent} />}
      {m === 'quiet' && <Quiet balance={balance} safe={safe} />}
      <div className="flex flex-wrap gap-x-4 gap-y-1.5 font-mono text-2xs text-ink-3">
        <span>advanced ·</span>
        <button type="button" className="text-ink-2 hover:text-ink" onClick={() => navigate('settings')}>
          another node
        </button>
        <button type="button" className="text-ink-2 hover:text-ink" onClick={() => navigate('settings')}>
          Ethereum RPC
        </button>
        <button type="button" className="text-ink-2 hover:text-ink" onClick={() => navigate('wallet')}>
          recovery file
        </button>
        <button type="button" className="text-ink-2 hover:text-ink" onClick={() => navigate('wallet')}>
          forward it myself
        </button>
      </div>
      {session && boot.phase === 'ready' && (
        <BridgeProviders>
          <SendAheadSheet session={session} balance={balance ?? 0n} open={ahead} onOpenChange={setAhead} />
        </BridgeProviders>
      )}
    </div>
  );
}
