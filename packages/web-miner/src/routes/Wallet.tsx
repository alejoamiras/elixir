import type { Crossing } from '@yacana/bridge/journal';
import { PARAMS } from '@yacana/miner-core/generated/params';
import { ownVersionName } from '@yacana/site/browser/version-name';
import { Badge, Button, ExternalLink, Kpi, Note, Tile, TileBoundary, TileHeader } from '@yacana/ui';
import { useAtomValue } from 'jotai';
import { useState } from 'react';
import { bridgeRecord, isContinuation, nextVersionName } from '../bridge/env';
import { moneyStanding } from '../bridge/rows';
import { links } from '../explorer';
import { ActivityList } from '../features/ActivityList';
import { WordsBackup } from '../features/account/Words';
import { BridgeProviders } from '../features/BridgeProviders';
import { ClaimDialog } from '../features/dialogs/Claim';
import { FromEthereumDialog } from '../features/dialogs/FromEthereum';
import { SendDialog } from '../features/dialogs/Send';
import { ToEthereumDialog } from '../features/dialogs/ToEthereum';
import { SignOutDialog } from '../features/SignOutDialog';
import type { MasterRecord } from '../keys/store';
import { amount, shortAddress } from '../lib/format';
import { useTileLog } from '../lib/tile-log';
import { navigate, takeIntent } from '../routes';
import type { Session } from '../session';
import { balanceAtom, bootAtom, bridgeAtom, claimsAtom } from '../state';

/** The balance with its two ways out (Send, To Ethereum) and the way in (Deposit from Ethereum) beside the account. */
export function BalanceTile({
  balance,
  claims,
  typedWords,
  onSend,
  onToEthereum,
  onDeposit,
  onSettings,
}: {
  balance: bigint | null;
  claims: number;
  /** The account was opened by typing 12 words: an empty balance may be a mistyped word's account. */
  typedWords?: boolean;
  onSend: () => void;
  onToEthereum: () => void;
  onDeposit: () => void;
  onSettings: () => void;
}) {
  const view = useAtomValue(bridgeAtom);
  const bridge = bridgeRecord() !== null;
  const money = moneyStanding(view, ownVersionName(), nextVersionName(view.canonical));
  return (
    <Tile>
      <TileHeader aside="private">balance</TileHeader>
      <Kpi
        label={<span className="sr-only">private balance</span>}
        value={
          <span data-testid="wallet-balance">
            {balance === null ? '…' : amount(balance, PARAMS.DECIMALS)}
          </span>
        }
        unit={PARAMS.TOKEN_SYMBOL}
        size="lg"
        sub={`${claims} ${claims === 1 ? 'claim' : 'claims'} · nothing about this balance is public`}
      />
      {typedWords && balance === 0n && (
        <Note title="Expected a balance?" className="mt-4" data-testid="empty-hint">
          A mistyped word opens a different, empty account: check your words.
        </Note>
      )}
      <div className="mt-4 flex flex-wrap gap-2">
        <Button variant="primary" onClick={onSend} disabled={!balance} data-testid="withdraw">
          Send
        </Button>
        {bridge && (
          <Button
            onClick={onToEthereum}
            disabled={!balance || money.off.has('to-ethereum')}
            data-testid="to-ethereum"
          >
            Bridge to Ethereum
          </Button>
        )}
        {bridge && (
          <Button
            variant="ghost"
            disabled={money.off.has('deposit')}
            onClick={onDeposit}
            data-testid="deposit"
          >
            Bridge from Ethereum
          </Button>
        )}
      </div>
      {bridge && money.reason && (
        <p className="mt-2 text-xs text-ink-3" data-testid="money-reason">
          {money.reason}
          {money.settings && (
            <>
              {' '}
              <Button variant="link" className="text-xs" onClick={onSettings} data-testid="money-settings">
                Settings
              </Button>
            </>
          )}
        </p>
      )}
    </Tile>
  );
}

function AccountTile({
  record,
  address,
  onSignOut,
  onBackUp,
}: {
  record: MasterRecord;
  /** The address this build opened (the record keeps the one it was made with, see `currentAddress`). */
  address: string;
  onSignOut: () => void;
  onBackUp: () => void;
}) {
  const method = record.method === 'passkey' ? 'passkey' : 'twelve words';
  return (
    <Tile>
      <TileHeader>account</TileHeader>
      <div className="flex items-center justify-between gap-3 rounded-[8px] border border-line-2 px-3.5 py-3">
        <div className="min-w-0">
          <ExternalLink
            href={links.address(address)}
            full={address}
            className="font-mono text-sm text-ink"
            data-testid="wallet-account"
          >
            {shortAddress(address)}
          </ExternalLink>
          <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-ink-3">
            <span>{method}</span>
            {record.method === 'words' && !record.backedUp && (
              <>
                <Badge variant="warn">not backed up</Badge>
                <Button variant="link" className="text-xs" onClick={onBackUp} data-testid="back-up-now">
                  Back up now
                </Button>
              </>
            )}
            {record.method === 'words' && record.backedUp && <span className="text-ok">backed up</span>}
            {record.askEveryOpen ? null : (
              <span className="whitespace-nowrap">· stays open on this device</span>
            )}
          </div>
        </div>
        <Button size="sm" onClick={onSignOut} data-testid="sign-out">
          Sign out
        </Button>
      </div>
      <p className="mt-3 text-xs text-ink-3">
        Signing out returns to the sign-in screen.{' '}
        {record.method === 'passkey'
          ? 'Your passkey signs you back in; the balance stays with the account.'
          : 'The twelve words open it again; the balance stays with the account.'}
      </p>
    </Tile>
  );
}

type Win = { epoch: bigint; block: number; at: number };

/** "wins · 12 ›" in the activity tile's footer; open, the wins from this device list below it. */
function WinsRow({ wins, open, onToggle }: { wins: Win[]; open: boolean; onToggle: () => void }) {
  return (
    <Button
      variant="link"
      className="label-mono no-underline"
      aria-expanded={open}
      onClick={onToggle}
      data-testid="wins-row"
    >
      wins · {wins.length} <span className="text-ink-4">{open ? '‹' : '›'}</span>
    </Button>
  );
}

function WinsList({ wins }: { wins: Win[] }) {
  return (
    <Tile className="md:col-span-2" data-testid="wins-list">
      <TileHeader aside={wins.length ? `${wins.length} · newest first` : undefined}>
        wins from this device
      </TileHeader>
      {wins.length ? (
        <ol
          className="m-0 max-h-[280px] list-none overflow-y-auto p-0 font-mono text-xs"
          data-testid="claims-history"
        >
          {[...wins].reverse().map((c) => (
            <li
              key={`${c.epoch}-${c.block}`}
              className="flex gap-4 border-t border-line py-1 first:border-t-0"
            >
              <span className="text-ink-2">
                {new Date(c.at).toISOString().slice(0, 16).replace('T', ' ')}
              </span>
              <span>epoch {c.epoch.toString()}</span>
              <span className="text-ink-2">
                block{' '}
                <ExternalLink href={links.block(c.block)} full={String(c.block)}>
                  {c.block.toLocaleString('en-US')}
                </ExternalLink>
              </span>
            </li>
          ))}
        </ol>
      ) : (
        <p className="text-xs text-ink-2">nothing yet</p>
      )}
    </Tile>
  );
}

type Held = [Crossing | null, (c: Crossing | null) => void];

/** The money dialogs on the bridge, each open on its own state; the old origin has no deposit. */
export function MoneyDialogs({
  session,
  balance,
  exit: [exit, setExit],
  deposit,
  redeem: [redeem, setRedeem],
  forward: [forward, setForward],
}: {
  session: Session;
  balance: bigint | null;
  exit: [boolean, (o: boolean) => void];
  deposit?: [false | { resume?: Crossing }, (d: false | { resume?: Crossing }) => void];
  redeem: Held;
  forward: Held;
}) {
  return (
    <>
      <ToEthereumDialog session={session} balance={balance ?? 0n} open={exit} onOpenChange={setExit} />
      {deposit?.[0] && (
        <FromEthereumDialog
          session={session}
          open
          onOpenChange={(o) => !o && deposit[1](false)}
          resume={deposit[0].resume}
        />
      )}
      <ClaimDialog
        session={session}
        crossing={redeem}
        action="redeem"
        onOpenChange={(o) => !o && setRedeem(null)}
      />
      <ClaimDialog
        session={session}
        crossing={forward}
        action="forward"
        onOpenChange={(o) => !o && setForward(null)}
      />
    </>
  );
}

export function Wallet({ session }: { session: Session }) {
  const onError = useTileLog();
  const boot = useAtomValue(bootAtom);
  const balance = useAtomValue(balanceAtom);
  const claims = useAtomValue(claimsAtom);
  const [intent] = useState(takeIntent);
  const [send, setSend] = useState(intent === 'send');
  const [exit, setExit] = useState(false);
  const [deposit, setDeposit] = useState<false | { resume?: Crossing }>(false);
  const [redeem, setRedeem] = useState<Crossing | null>(null);
  const [forward, setForward] = useState<Crossing | null>(null);
  const [signOut, setSignOut] = useState(false);
  const [wins, setWins] = useState(false);
  // A backup opened from the sign-out dialog (here, or Welcome's before the account opened) returns
  // to the dialog once the words are confirmed.
  const [backup, setBackup] = useState<false | 'account' | 'sign-out'>(
    intent === 'backup' ? 'sign-out' : false,
  );
  if (boot.phase !== 'ready') return null;
  const account = boot.account;
  const words = session.openWords;
  if (backup && words)
    return (
      <Tile>
        <WordsBackup
          phrase={words}
          eyebrow="account · 12 words"
          onDone={async () => {
            await session.markBackedUp();
            setSignOut(backup === 'sign-out');
            setBackup(false);
          }}
        />
      </Tile>
    );
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <TileBoundary name="balance" onError={onError}>
        <BalanceTile
          balance={balance}
          claims={claims.length}
          typedWords={boot.typedWords}
          onSend={() => setSend(true)}
          onToEthereum={() => setExit(true)}
          onDeposit={() => setDeposit({})}
          onSettings={() => navigate('settings')}
        />
      </TileBoundary>
      <TileBoundary name="account" onError={onError}>
        <AccountTile
          record={boot.record}
          address={account}
          onSignOut={() => setSignOut(true)}
          onBackUp={() => setBackup('account')}
        />
      </TileBoundary>
      <BridgeProviders>
        <TileBoundary name="activity" onError={onError} className="md:col-span-2">
          <ActivityList
            session={session}
            account={account}
            continuation={isContinuation()}
            wins={<WinsRow wins={claims} open={wins} onToggle={() => setWins((o) => !o)} />}
            on={{
              claimL1: setForward,
              forward: setForward,
              redeem: setRedeem,
              // A send-ahead is made again from Mine's upgrade card; the other two open here.
              again: (c) =>
                c.kind === 3 ? setDeposit({ resume: c }) : c.kind === 1 ? setExit(true) : navigate('mine'),
              settings: () => navigate('settings'),
            }}
          />
        </TileBoundary>
        {wins && (
          <TileBoundary name="wins" onError={onError} className="md:col-span-2">
            <WinsList wins={claims} />
          </TileBoundary>
        )}
        <MoneyDialogs
          session={session}
          balance={balance}
          exit={[exit, setExit]}
          deposit={[deposit, setDeposit]}
          redeem={[redeem, setRedeem]}
          forward={[forward, setForward]}
        />
      </BridgeProviders>
      <SendDialog
        session={session}
        self={account}
        balance={balance ?? 0n}
        open={send}
        onOpenChange={setSend}
      />
      <SignOutDialog
        record={boot.record}
        open={signOut}
        onOpenChange={setSignOut}
        onSignOut={() => session.forget(boot.record)}
        onBackUp={() => {
          setSignOut(false);
          setBackup('sign-out');
        }}
      />
    </div>
  );
}
