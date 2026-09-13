import { useAtomValue } from 'jotai';
import { useState } from 'react';
import type { Crossing } from '../../../bridge/src/journal.ts';
import { PARAMS } from '../../../miner-core/src/generated/params.ts';
import { Badge, Button, ExternalLink, Kpi, Tile, TileBoundary, TileHeader } from '../../../ui/src/index.ts';
import { bridgeRecord } from '../bridge/env';
import { links } from '../explorer';
import { ArrivalCard } from '../features/ArrivalCard';
import { BridgeProviders } from '../features/BridgeProviders';
import { BridgeTile } from '../features/BridgeTile';
import { DepositSheet, HeldSheet } from '../features/DepositSheet';
import { SendSheet } from '../features/SendSheet';
import { SignOutDialog } from '../features/SignOutDialog';
import { ToEthereumSheet } from '../features/ToEthereumSheet';
import { WordsBackup } from '../features/WordsScreens';
import type { MasterRecord } from '../keys/store';
import { amount, shortAddress } from '../lib/format';
import { useTileLog } from '../lib/tile-log';
import { takeIntent } from '../routes';
import type { Session } from '../session';
import { balanceAtom, bootAtom, bridgeAtom, claimsAtom } from '../state';

/** The balance with its two ways out (Send, To Ethereum) and the way in (Deposit from Ethereum) beside the account. */
export function BalanceTile({
  balance,
  claims,
  onSend,
  onToEthereum,
  onDeposit,
}: {
  balance: bigint | null;
  claims: number;
  onSend: () => void;
  onToEthereum: () => void;
  onDeposit: () => void;
}) {
  const view = useAtomValue(bridgeAtom);
  const bridge = bridgeRecord() !== null;
  const standing = view.standing;
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
      <div className="mt-4 flex flex-wrap gap-2">
        <Button variant="primary" onClick={onSend} disabled={!balance} data-testid="withdraw">
          Send
        </Button>
        {bridge && (
          <Button
            onClick={onToEthereum}
            disabled={!balance || view.rpcFailing || !standing?.registered}
            data-testid="to-ethereum"
          >
            To Ethereum
          </Button>
        )}
        {bridge && (
          <Button
            variant="ghost"
            disabled={!standing?.registered || standing.depositsClosed}
            onClick={onDeposit}
            data-testid="deposit"
          >
            Deposit from Ethereum
          </Button>
        )}
      </div>
    </Tile>
  );
}

function AccountTile({
  record,
  onSignOut,
  onBackUp,
}: {
  record: MasterRecord;
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
            href={links.address(record.account.address)}
            full={record.account.address}
            className="font-mono text-sm text-ink"
            data-testid="wallet-account"
          >
            {shortAddress(record.account.address)}
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

function ClaimsHistory({ claims }: { claims: { epoch: bigint; block: number; at: number }[] }) {
  return (
    <Tile className="md:col-span-2">
      <TileHeader aside={claims.length ? `${claims.length} · newest first` : undefined}>
        claims from this device
      </TileHeader>
      {claims.length ? (
        <ol
          className="m-0 max-h-[280px] list-none overflow-y-auto p-0 font-mono text-xs"
          data-testid="claims-history"
        >
          {[...claims].reverse().map((c) => (
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

export function Wallet({ session }: { session: Session }) {
  const onError = useTileLog();
  const boot = useAtomValue(bootAtom);
  const balance = useAtomValue(balanceAtom);
  const claims = useAtomValue(claimsAtom);
  const [send, setSend] = useState(() => takeIntent() === 'send');
  const [exit, setExit] = useState(false);
  const [deposit, setDeposit] = useState<false | { resume?: Crossing }>(false);
  const [redeem, setRedeem] = useState<Crossing | null>(null);
  const [forward, setForward] = useState<Crossing | null>(null);
  const [signOut, setSignOut] = useState(false);
  // A backup opened from the sign-out dialog returns to the dialog once the words are confirmed.
  const [backup, setBackup] = useState<false | 'account' | 'sign-out'>(false);
  if (boot.phase !== 'ready') return null;
  const account = boot.account;
  const words = session.openWords;
  if (backup && words)
    return (
      <Tile>
        <WordsBackup
          phrase={words}
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
          onSend={() => setSend(true)}
          onToEthereum={() => setExit(true)}
          onDeposit={() => setDeposit({})}
        />
      </TileBoundary>
      <TileBoundary name="account" onError={onError}>
        <AccountTile
          record={boot.record}
          onSignOut={() => setSignOut(true)}
          onBackUp={() => setBackup('account')}
        />
      </TileBoundary>
      <TileBoundary name="claims" onError={onError} className="md:col-span-2">
        <ClaimsHistory claims={claims} />
      </TileBoundary>
      <BridgeProviders>
        <TileBoundary name="bridge" onError={onError} className="md:col-span-2">
          <BridgeTile session={session} account={account} onForward={setForward} onRedeem={setRedeem} />
        </TileBoundary>
        <TileBoundary name="arrivals" onError={onError} className="md:col-span-2">
          <ArrivalCard
            session={session}
            onResume={(c) => setDeposit({ resume: c })}
            className="md:col-span-2"
          />
        </TileBoundary>
        <ToEthereumSheet session={session} balance={balance ?? 0n} open={exit} onOpenChange={setExit} />
        {deposit && (
          <DepositSheet
            session={session}
            open
            onOpenChange={(o) => !o && setDeposit(false)}
            resume={deposit.resume}
          />
        )}
        <HeldSheet
          session={session}
          crossing={redeem}
          action="redeem"
          onOpenChange={(o) => !o && setRedeem(null)}
        />
        <HeldSheet
          session={session}
          crossing={forward}
          action="forward"
          onOpenChange={(o) => !o && setForward(null)}
        />
      </BridgeProviders>
      <SendSheet
        session={session}
        self={account}
        balance={balance ?? 0n}
        open={send}
        onOpenChange={setSend}
      />
      <SignOutDialog
        record={boot.record}
        balance={balance}
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
