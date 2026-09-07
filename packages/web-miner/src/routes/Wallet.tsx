import { useAtomValue } from 'jotai';
import { useState } from 'react';
import { PARAMS } from '../../../miner-core/src/generated/params.ts';
import { Badge, Button, ExternalLink, Input, Kpi, Tile, TileHeader } from '../../../ui/src/index.ts';
import { links } from '../explorer';
import { SendSheet } from '../features/SendSheet';
import { SignOutDialog } from '../features/SignOutDialog';
import { WordsBackup } from '../features/WordsScreens';
import type { MasterRecord } from '../keys/store';
import { amount, shortAddress } from '../lib/format';
import { takeIntent } from '../routes';
import type { Session } from '../session';
import { balanceAtom, bootAtom, claimsAtom } from '../state';

function BalanceTile({
  account,
  balance,
  claims,
  onSend,
}: {
  account: string;
  balance: bigint | null;
  claims: number;
  onSend: () => void;
}) {
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
      <div className="mt-4 flex gap-3">
        <Button variant="primary" onClick={onSend} disabled={!balance} data-testid="withdraw">
          Send
        </Button>
      </div>
      <div className="mt-4 flex items-center gap-2 text-xs">
        <span className="inline-flex items-center gap-1.5 rounded-sm border border-line bg-panel px-2 py-1 font-mono text-2xs text-ink-2">
          <span>account</span>
          <ExternalLink
            href={links.address(account)}
            full={account}
            copy
            className="text-ink"
            data-testid="wallet-account"
          >
            {shortAddress(account)}
          </ExternalLink>
        </span>
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
          <div className="font-mono text-sm" title={record.account.address}>
            {shortAddress(record.account.address)}
          </div>
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
            {record.askEveryOpen ? null : <span>· stays open on this device</span>}
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

/** A recipient's wallet only finds a new sender's notes once told about the sender; this is where it is told. */
function Senders({ session }: { session: Session }) {
  const [sender, setSender] = useState('');
  const [note, setNote] = useState<string>();
  return (
    <Tile flat className="md:col-span-2">
      <TileHeader>expecting a private transfer from another Yacana account?</TileHeader>
      <p className="mb-2 text-xs text-ink-2">Add their address so this account can find their notes.</p>
      <div className="flex gap-2">
        <Input
          value={sender}
          onChange={(e) => setSender(e.target.value)}
          placeholder="0x…"
          className="font-mono"
          aria-label="sender address"
          data-testid="sender"
        />
        <Button
          size="sm"
          onClick={() =>
            void session
              .addSender(sender.trim())
              .then(() => setNote('added'))
              .catch((e: unknown) => setNote(e instanceof Error ? e.message : String(e)))
          }
          data-testid="add-sender"
        >
          Add
        </Button>
      </div>
      {note && <p className="mt-2 text-xs text-ink-2">{note}</p>}
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
  const boot = useAtomValue(bootAtom);
  const balance = useAtomValue(balanceAtom);
  const claims = useAtomValue(claimsAtom);
  const [send, setSend] = useState(() => takeIntent() === 'send');
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
      <BalanceTile account={account} balance={balance} claims={claims.length} onSend={() => setSend(true)} />
      <AccountTile
        record={boot.record}
        onSignOut={() => setSignOut(true)}
        onBackUp={() => setBackup('account')}
      />
      <Senders session={session} />
      <ClaimsHistory claims={claims} />
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
