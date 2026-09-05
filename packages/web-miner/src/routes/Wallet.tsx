import { useAtomValue } from 'jotai';
import { useEffect, useState } from 'react';
import { PARAMS } from '../../../miner-core/src/generated/params.ts';
import { Badge, Button, Input, Kpi, KvRow, Tile, TileHeader } from '../../../ui/src/index.ts';
import { WithdrawSheet } from '../features/WithdrawSheet';
import { WordsBackup } from '../features/WordsScreens';
import { listRecords, type MasterRecord } from '../keys/store';
import { amount, shortAddress } from '../lib/format';
import type { Session } from '../session';
import { balanceAtom, bootAtom, claimsAtom } from '../state';

function Recovery({ record, onBackup }: { record: MasterRecord; onBackup: () => void }) {
  if (record.method === 'passkey')
    return (
      <KvRow
        label="recovery"
        value={<span>passkey · synced by your platform · nothing to write down</span>}
      />
    );
  return (
    <KvRow
      label="recovery"
      value={
        record.backedUp ? (
          <span className="text-ok">twelve words · backed up</span>
        ) : (
          <span className="flex items-center gap-3">
            <Badge variant="warn">not backed up</Badge>
            <Button variant="link" onClick={onBackup} data-testid="back-up-now">
              Back up now
            </Button>
          </span>
        )
      }
    />
  );
}

/** Forgetting needs the address's last four characters typed back. */
function ForgetKey({ record, session }: { record: MasterRecord; session: Session }) {
  const [typed, setTyped] = useState('');
  const last4 = record.account.address.slice(-4);
  return (
    <span className="flex items-center gap-2">
      <Input
        value={typed}
        onChange={(e) => setTyped(e.target.value)}
        placeholder={`type ${last4}`}
        className="h-[30px] w-28 font-mono text-xs"
        aria-label="confirm forget"
        data-testid="forget-confirm"
      />
      <Button
        variant="danger"
        size="sm"
        disabled={typed.trim().toLowerCase() !== last4}
        onClick={() => void session.forget(record)}
        data-testid="forget-key"
      >
        Forget
      </Button>
    </span>
  );
}
function KeysOnDevice({ session, account }: { session: Session; account: string }) {
  const [records, setRecords] = useState<MasterRecord[]>([]);
  useEffect(() => {
    void listRecords().then(setRecords);
  }, []);
  return (
    <Tile>
      <TileHeader>keys on this device</TileHeader>
      {records.map((r) => (
        <div
          key={r.id}
          className="flex items-center justify-between gap-3 border-t border-line py-2 text-sm first:border-t-0"
        >
          <span className="font-mono text-xs" title={r.account.address}>
            {shortAddress(r.account.address)}
            {r.account.address === account && <span className="ml-2 text-uv-2">current</span>}
            <span className="ml-2 text-ink-2">{r.method === 'passkey' ? 'passkey' : 'words'}</span>
          </span>
          <ForgetKey record={r} session={session} />
        </div>
      ))}
      <p className="mt-3 text-xs text-ink-2">
        Forgetting removes the key from this device only; a passkey or the words bring it back.
      </p>
    </Tile>
  );
}

function Senders({ session }: { session: Session }) {
  const [sender, setSender] = useState('');
  const [note, setNote] = useState<string>();
  return (
    <Tile>
      <TileHeader>expecting a private transfer?</TileHeader>
      <p className="mb-2 text-xs text-ink-2">
        Notes are found by sender. Add the sender's address so this key can see what they send.
      </p>
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
      <TileHeader>claims from this device</TileHeader>
      {claims.length ? (
        <ol className="m-0 list-none p-0 font-mono text-xs">
          {[...claims].reverse().map((c) => (
            <li
              key={`${c.epoch}-${c.block}`}
              className="flex gap-4 border-t border-line py-1 first:border-t-0"
            >
              <span className="text-ink-2">
                {new Date(c.at).toISOString().slice(0, 16).replace('T', ' ')}
              </span>
              <span>epoch {c.epoch.toString()}</span>
              <span className="text-ink-2">block {c.block.toLocaleString('en-US')}</span>
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
  const [withdraw, setWithdraw] = useState(false);
  const [backup, setBackup] = useState(false);
  const [copied, setCopied] = useState(false);
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
            setBackup(false);
          }}
        />
      </Tile>
    );
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Tile className="md:col-span-2">
        <TileHeader>private balance</TileHeader>
        <Kpi
          label="this key holds"
          value={
            <span data-testid="wallet-balance">
              {balance === null ? '…' : amount(balance, PARAMS.DECIMALS)}
            </span>
          }
          unit={PARAMS.TOKEN_SYMBOL}
          size="lg"
          sub={`${claims.length} ${claims.length === 1 ? 'claim' : 'claims'} · nothing about this balance is public`}
        />
        <div className="mt-4 flex gap-3">
          <Button
            variant="primary"
            onClick={() => setWithdraw(true)}
            disabled={!balance}
            data-testid="withdraw"
          >
            Withdraw
          </Button>
          <Button
            onClick={() =>
              navigator.clipboard
                ?.writeText(account)
                .then(() => setCopied(true))
                .catch(() => setCopied(false))
            }
            data-testid="receive"
          >
            {copied ? 'Address copied' : 'Receive'}
          </Button>
        </div>
        <p className="mt-3 text-xs text-ink-2">
          Receiving to a mining key links its first claim to whoever you give it to.
        </p>
        <Recovery record={boot.record} onBackup={() => setBackup(true)} />
        <KvRow label="address" value={<span title={account}>{shortAddress(account)}</span>} />
      </Tile>
      <KeysOnDevice session={session} account={account} />
      <Senders session={session} />
      <ClaimsHistory claims={claims} />
      <WithdrawSheet
        session={session}
        self={account}
        balance={balance ?? 0n}
        open={withdraw}
        onOpenChange={setWithdraw}
      />
    </div>
  );
}
