// The versioned origin's one page (the `old` role). Nothing is mined or created here; with the node
// gone nothing is read at all, and the page says so before any node access.

import { dayOf, deadlinePhrase } from '@yacana/bridge/exit-deadline';
import type { Crossing } from '@yacana/bridge/journal';
import { PARAMS } from '@yacana/miner-core/generated/params';
import { Button, type ChipTone, ExternalLink, Kpi, StatusChip, Tile, TileHeader } from '@yacana/ui';
import { ownVersionName } from '@yacana/web-kit/browser/version-name';
import { useAtomValue, useSetAtom } from 'jotai';
import { useState } from 'react';
import { proofChip } from '../bridge/copy';
import { lifecycleRecord, nextVersionName } from '../bridge/env';
import { moneyStanding } from '../bridge/rows';
import { links } from '../explorer';
import { apexHost, apexOrigin } from '../lib/apex';
import { amount as fmt, shortAddress } from '../lib/format';
import { navigate } from '../routes';
import { MoneyDialogs } from '../routes/Wallet';
import type { Session } from '../session';
import { balanceAtom, bootAtom, bridgeAtom, nowAtom, signInAtom } from '../state';
import { ActivityList } from './ActivityList';
import { BridgeProviders } from './BridgeProviders';
import { SendAheadDialog } from './dialogs/SendAhead';

/** The version as the hero says it: proving, silent for hours, stopped for good, its node gone. */
export type OldState = 'live' | 'silent' | 'quiet' | 'gone';

interface Chip {
  word: string;
  tone: ChipTone;
  silentS?: number;
}

function Hero({
  state,
  chip,
  next,
  flipAt,
}: {
  state: OldState;
  chip?: Chip;
  next: string;
  flipAt?: bigint;
}) {
  const v = ownVersionName();
  const host = <b>{apexHost()}</b>;
  const title =
    state === 'quiet'
      ? `${v} has stopped proving. Nothing more can leave.`
      : state === 'gone'
        ? `${v}’s node has shut down. Nothing more can leave from here.`
        : 'Send what’s still here ahead.';
  return (
    <div data-testid="retired" data-state={state}>
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <span className="label-mono">
          aztec {v.toLowerCase()} · retired{flipAt ? ` · ${dayOf(flipAt).toLowerCase()}` : ''}
        </span>
        {chip && (
          <StatusChip tone={chip.tone} data-testid="proof-chip">
            {chip.word}
          </StatusChip>
        )}
      </div>
      <h1 className="mt-2 text-balance text-[32px] font-semibold leading-[1.1] tracking-[-0.025em]">
        {title}
      </h1>
      <p className="mt-3 text-pretty text-base leading-[1.55] text-ink-2 [&_b]:font-medium [&_b]:text-ink">
        {state === 'live' && (
          <>
            Mining moved to {next} at {host}. Your balance can still leave while {v} keeps proving, and {v}{' '}
            can stop at any time: send it ahead to {next} now, or bridge it to Ethereum.
          </>
        )}
        {state === 'silent' && (
          <>
            Mining moved to {next} at {host}. {v} hasn’t proved an epoch for{' '}
            {Math.round((chip?.silentS ?? 0) / 360) / 10} hours and may have stopped. A send it never proves
            comes back here; one it proves is held on Ethereum for {next}.
          </>
        )}
        {state === 'quiet' && <QuietBody v={v} next={next} />}
        {state === 'gone' && (
          <>
            What {v} proved in time is on {next}, or held on Ethereum for {next}: see it at {host}. A device
            that never held a send restores its recovery file there.
          </>
        )}
      </p>
    </div>
  );
}

function QuietBody({ v, next }: { v: string; next: string }) {
  const view = useAtomValue(bridgeAtom);
  return (
    <>
      What {v} proved in time is on {next}, or held on Ethereum for {next}, redeemable{' '}
      {deadlinePhrase(view.deadline, next)}. What was still here when it stopped can no longer leave.
    </>
  );
}

/** The balance, and for assistive tech and the specs the account it belongs to (the header's chip is short). */
const Balance = ({ balance, account }: { balance: bigint | null; account: string }) => (
  <>
    <Kpi
      label={<span className="sr-only">balance</span>}
      value={
        <span data-testid="wallet-balance">{balance === null ? '…' : fmt(balance, PARAMS.DECIMALS)}</span>
      }
      unit={PARAMS.TOKEN_SYMBOL}
      size="lg"
    />
    <p className="sr-only">
      account{' '}
      <ExternalLink href={links.address(account)} full={account} tabIndex={-1} data-testid="account">
        {shortAddress(account)}
      </ExternalLink>
    </p>
  </>
);

function SignedOutCard() {
  const openSignIn = useSetAtom(signInAtom);
  return (
    <Tile data-testid="old-card" data-state="signed-out">
      <TileHeader>still on {ownVersionName()}</TileHeader>
      <p className="text-sm text-ink-2">Log in to see what’s still here.</p>
      <div className="mt-3">
        <Button variant="uv" onClick={() => openSignIn(true)} data-testid="sign-in-mine">
          Log in
        </Button>
      </div>
      <p className="mt-3 text-xs text-ink-3">
        Accounts are restored here, not created. The passkey or 12 words from {apexHost()} open it.
      </p>
    </Tile>
  );
}

function GoneCard() {
  const v = ownVersionName();
  return (
    <Tile data-testid="old-card" data-state="gone">
      <TileHeader>still on {v}</TileHeader>
      <p className="text-sm text-ink-2">
        Logging in here needed {v}’s node, and it is gone. Nothing on this page can change any more.
      </p>
      <div className="mt-3">
        <Button variant="uv" asChild>
          <a href={apexOrigin()} data-testid="open-apex">
            Open {apexHost()}
          </a>
        </Button>
      </div>
    </Tile>
  );
}

function QuietCard({ balance, account }: { balance: bigint | null; account: string }) {
  const v = ownVersionName();
  return (
    <Tile className="opacity-70" data-testid="old-card" data-state="quiet">
      <TileHeader aside="cannot leave">still on {v}</TileHeader>
      <Balance balance={balance} account={account} />
      <p className="mt-2 text-xs text-ink-3">Left here when {v} stopped proving.</p>
    </Tile>
  );
}

function StillHereCard({
  balance,
  account,
  next,
  onSendAhead,
  onToEthereum,
}: {
  balance: bigint | null;
  account: string;
  next: string;
  onSendAhead: () => void;
  onToEthereum: () => void;
}) {
  const v = ownVersionName();
  const view = useAtomValue(bridgeAtom);
  const standing = moneyStanding(view, v, next);
  return (
    <Tile className="border-uv" data-testid="old-card" data-state="still-here">
      <TileHeader aside={`private · can leave while ${v} proves`}>still on {v}</TileHeader>
      <Balance balance={balance} account={account} />
      <div className="mt-3.5 flex flex-wrap items-center gap-3.5">
        <Button
          variant="uv"
          size="lg"
          disabled={!balance || view.rpcFailing}
          onClick={onSendAhead}
          data-testid="send-ahead"
        >
          Send ahead to {next}
        </Button>
        <Button
          variant="link"
          className="text-ink-2"
          disabled={!balance || standing.off.has('to-ethereum')}
          onClick={onToEthereum}
          data-testid="to-ethereum"
        >
          or bridge to Ethereum
        </Button>
      </div>
      {standing.off.has('to-ethereum') && standing.reason && (
        <p className="mt-2 text-xs text-ink-3" data-testid="money-reason">
          {standing.reason}
          {standing.settings && (
            <>
              {' '}
              <Button
                variant="link"
                className="text-xs"
                onClick={() => navigate('settings')}
                data-testid="money-settings"
              >
                Settings
              </Button>
            </>
          )}
        </p>
      )}
      <p className="mt-3 text-xs text-ink-3">
        Then claim it on {next} with one tap, at {apexHost()}. Same passkey.
      </p>
    </Tile>
  );
}

/** The state the hero reads: the operator's notes first, then the proving chip's silence. */
export const oldState = (chip: Chip | undefined, gone: boolean, stopped: boolean): OldState =>
  gone ? 'gone' : stopped ? 'quiet' : chip?.silentS !== undefined ? 'silent' : 'live';

/** What is still here, the way out, and the money dialogs the rows and the card open. */
function SignedIn({
  session,
  account,
  state,
  next,
  balance,
}: {
  session: Session;
  account: string;
  state: OldState;
  next: string;
  balance: bigint | null;
}) {
  const [ahead, setAhead] = useState(false);
  const [exit, setExit] = useState(false);
  const [redeem, setRedeem] = useState<Crossing | null>(null);
  const [forward, setForward] = useState<Crossing | null>(null);
  return (
    <>
      {state === 'quiet' ? (
        <QuietCard balance={balance} account={account} />
      ) : (
        <StillHereCard
          balance={balance}
          account={account}
          next={next}
          onSendAhead={() => setAhead(true)}
          onToEthereum={() => setExit(true)}
        />
      )}
      {/* The rows and the dialogs are wagmi's: they mount once the bridge session is open, the card before. */}
      <BridgeProviders>
        <ActivityList
          session={session}
          account={account}
          wins={null}
          on={{
            claimL1: setForward,
            forward: setForward,
            redeem: setRedeem,
            // A send-ahead again from the card; an exit again from its dialog; a deposit never from here.
            again: (c) => (c.kind === 2 ? setAhead(true) : c.kind === 1 ? setExit(true) : undefined),
            settings: () => navigate('settings'),
          }}
        />
        <SendAheadDialog session={session} balance={balance ?? 0n} open={ahead} onOpenChange={setAhead} />
        <MoneyDialogs
          session={session}
          balance={balance}
          exit={[exit, setExit]}
          redeem={[redeem, setRedeem]}
          forward={[forward, setForward]}
        />
      </BridgeProviders>
    </>
  );
}

export function OldApp({ session }: { session?: Session }) {
  const boot = useAtomValue(bootAtom);
  const view = useAtomValue(bridgeAtom);
  const balance = useAtomValue(balanceAtom);
  const now = useAtomValue(nowAtom);
  const life = lifecycleRecord();
  const gone = life?.nodeRetired === true;
  const ready = boot.phase === 'ready';
  const v = ownVersionName();
  const next = nextVersionName(view.canonical);
  // The chip reads the bridge session's proof scan, which exists only signed in; gone, there is no node to read.
  const chip: Chip | undefined = gone
    ? { word: `${v}’s node has shut down`, tone: 'bad' }
    : ready
      ? proofChip(view.proof, life?.stoppedProvingAt, Math.floor(now / 1000), v)
      : undefined;
  const state = oldState(chip, gone, life?.stoppedProvingAt !== undefined);
  const flipAt = view.standing && view.standing.flipAt > 0n ? view.standing.flipAt : undefined;
  return (
    <div className="mx-auto flex w-full max-w-[760px] flex-col gap-[18px] py-6" data-testid="cockpit">
      <Hero state={state} chip={chip} next={next} flipAt={flipAt} />
      {gone ? (
        <GoneCard />
      ) : !ready || !session ? (
        <SignedOutCard />
      ) : (
        <SignedIn session={session} account={boot.account} state={state} next={next} balance={balance} />
      )}
    </div>
  );
}
