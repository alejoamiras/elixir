// From Ethereum: connect a wallet (every installed one the browser announces, by name) → amount →
// approve, deposit (two transactions from that wallet) → it crosses; the arrival card's Claim
// finishes it here. Also the sheet a held send-ahead is redeemed from: the same wallet pays the gas.
import { useAtomValue } from 'jotai';
import { useState } from 'react';
import type { Hex } from 'viem';
import { useAccount, useChainId, useConnect, useConnectors, useDisconnect, useReadContract } from 'wagmi';
import type { Crossing } from '../../../bridge/src/journal.ts';
import { yacaAbi } from '../../../bridge/src/portal.ts';
import { PARAMS } from '../../../miner-core/src/generated/params.ts';
import {
  Alert,
  AlertDescription,
  Button,
  Input,
  KvRow,
  Label,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from '../../../ui/src/index.ts';
import { bridgeRecord } from '../bridge/env';
import { reviewAmount } from '../bridge/forms';
import { amount as fmt, shortAddress } from '../lib/format';
import type { Session } from '../session';
import { bridgeAtom } from '../state';

/** The connected account's YACA on Ethereum, read through the RPC in use every few seconds. */
function YacaBalance({ owner }: { owner: Hex }) {
  const yaca = bridgeRecord()?.yaca as Hex | undefined;
  const { data } = useReadContract({
    address: yaca,
    abi: yacaAbi,
    functionName: 'balanceOf',
    args: [owner],
    query: { enabled: yaca !== undefined, refetchInterval: 5_000 },
  });
  return (
    <span className="text-2xs text-ink-2">
      <span data-testid="yaca-balance">{data === undefined ? '…' : fmt(data, PARAMS.DECIMALS)}</span> YACA
    </span>
  );
}

/** The wallet picker: EIP-6963 announcements by name and icon; nothing else. */
export function WalletPicker() {
  const connectors = useConnectors();
  const { connect, isPending, error } = useConnect();
  const account = useAccount();
  const { disconnect } = useDisconnect();
  const chainId = useChainId();
  // wagmi is still asking the wallets the page connected before: no picker until it knows.
  if (account.status === 'reconnecting')
    return (
      <p className="text-xs text-ink-2" data-testid="wallet-reconnecting">
        Reconnecting your Ethereum wallet…
      </p>
    );
  if (account.isConnected && account.address)
    return (
      <div
        className="flex items-center justify-between gap-3 rounded-[8px] border border-line-2 px-3.5 py-2.5"
        data-testid="eth-account"
      >
        <span className="flex flex-col font-mono text-sm">
          <span>
            {shortAddress(account.address)}
            <span className="text-2xs text-ink-3">
              {' '}
              · {account.connector?.name} · chain {chainId}
            </span>
          </span>
          <YacaBalance owner={account.address} />
        </span>
        <Button size="sm" variant="ghost" onClick={() => disconnect()} data-testid="eth-disconnect">
          Disconnect
        </Button>
      </div>
    );
  return (
    <div className="flex flex-col gap-2" data-testid="wallet-picker">
      {connectors.length === 0 && (
        <p className="text-xs text-ink-2">No Ethereum wallet is installed in this browser.</p>
      )}
      {connectors.map((c) => (
        <Button
          key={c.uid}
          size="sm"
          disabled={isPending}
          onClick={() => connect({ connector: c })}
          data-testid="wallet-option"
        >
          {c.icon && <img src={c.icon} alt="" className="mr-2 size-4" />}
          {c.name}
        </Button>
      ))}
      {error && <p className="text-xs text-warn">{error.message.split('\n')[0]}</p>}
    </div>
  );
}

type Step = { kind: 'form' } | { kind: 'approve' } | { kind: 'deposit' } | { kind: 'done' };

const firstLine = (e: unknown) => (e instanceof Error ? (e.message.split('\n')[0] ?? '') : String(e));

export function DepositSheet({
  session,
  open,
  onOpenChange,
  resume,
}: {
  session: Session;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** A deposit the wallet never answered: its amount comes prefilled; a new one goes out and this one is given up. */
  resume?: Crossing;
}) {
  const account = useAccount();
  const view = useAtomValue(bridgeAtom);
  const [text, setText] = useState(
    resume ? fmt(BigInt(resume.amount), PARAMS.DECIMALS, PARAMS.DECIMALS) : '',
  );
  const [step, setStep] = useState<Step>({ kind: 'form' });
  const [error, setError] = useState<string>();
  const close = () => {
    setStep({ kind: 'form' });
    setError(undefined);
    setText('');
    onOpenChange(false);
  };
  const go = async () => {
    setError(undefined);
    try {
      // The Ethereum balance is the wallet's to know; the portal refuses more than it holds.
      const { amount } = reviewAmount(text, (1n << 128n) - 1n, PARAMS.DECIMALS);
      setStep({ kind: 'approve' });
      await session.bridge?.deposit(amount, (s) => setStep({ kind: s }), resume);
      setStep({ kind: 'done' });
    } catch (e) {
      setStep({ kind: 'form' });
      setError(firstLine(e));
    }
  };
  const busy = step.kind === 'approve' || step.kind === 'deposit';
  const label =
    step.kind === 'approve'
      ? 'Waiting for your wallet · approve…'
      : step.kind === 'deposit'
        ? 'Waiting for your wallet · deposit…'
        : 'Approve and deposit';
  return (
    <Sheet open={open} onOpenChange={(o) => (o ? onOpenChange(true) : close())}>
      <SheetContent data-testid="deposit-sheet">
        <SheetTitle>Deposit from Ethereum</SheetTitle>
        <SheetDescription>
          YACA on Ethereum becomes {PARAMS.TOKEN_SYMBOL} here, privately, once you claim it. Two transactions
          from your Ethereum wallet: an approval, then the deposit.
        </SheetDescription>
        {view.standing?.depositsClosed && (
          <Alert variant="warn" data-testid="deposits-closed">
            <AlertDescription>
              Deposits into this version are closed: an upgrade is a day away or less.
            </AlertDescription>
          </Alert>
        )}
        {error && (
          <Alert variant="bad" data-testid="deposit-error">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        <WalletPicker />
        {step.kind !== 'done' && (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <Label htmlFor="deposit-amount">Amount</Label>
              <Input
                id="deposit-amount"
                value={text}
                onChange={(e) => setText(e.target.value)}
                inputMode="decimal"
                placeholder="0.00"
                className="font-mono"
                disabled={busy}
                data-testid="deposit-amount"
              />
            </div>
            <KvRow label="into" value={`Aztec V${import.meta.env.VITE_ROLLUP_VERSION} · this account`} />
            <Button
              variant="uv"
              disabled={!account.isConnected || busy || !text || view.standing?.depositsClosed}
              onClick={() => void go()}
              data-testid="deposit-go"
            >
              {label}
            </Button>
          </div>
        )}
        {step.kind === 'done' && (
          <div className="flex flex-col gap-4" data-testid="deposit-done">
            <p className="text-lg font-semibold">Deposited.</p>
            <p className="text-sm text-ink-2">
              Crossing to Aztec: a few minutes. It appears on the arrival card with a Claim.
            </p>
            <Button variant="primary" onClick={close}>
              Done
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

export type HeldAction = 'forward' | 'redeem';

const COPY: Record<HeldAction, { title: string; go: string; done: string }> = {
  forward: { title: 'Forward it yourself', go: 'Forward', done: 'Forwarded.' },
  redeem: { title: 'Redeem to Ethereum', go: 'Redeem', done: 'Redeemed.' },
};

const describe = (action: HeldAction, c: Crossing): string => {
  if (action === 'redeem')
    return 'The send-ahead becomes YACA on Ethereum for the connected account. This account’s own secret signs; the wallet pays the gas.';
  return c.kind === 1
    ? 'The exit is forwarded by you: YACA minted on Ethereum for its recipient. Anyone may; the wallet pays the gas.'
    : 'The send-ahead is forwarded into the live version by you: this account’s own secret signs, the wallet pays the gas. It then lands on the arrival card there.';
};

/**
 * What the holder does with a crossing on Ethereum, from the connected wallet: forward it (an exit,
 * or a held send-ahead into the live version) or redeem a held send-ahead as YACA for that account.
 */
export function HeldSheet({
  session,
  crossing,
  action,
  onOpenChange,
}: {
  session: Session;
  crossing: Crossing | null;
  action: HeldAction;
  onOpenChange: (open: boolean) => void;
}) {
  const account = useAccount();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [done, setDone] = useState(false);
  const close = () => {
    setError(undefined);
    setDone(false);
    onOpenChange(false);
  };
  const go = async () => {
    if (!crossing || !account.address) return;
    setBusy(true);
    setError(undefined);
    try {
      if (action === 'redeem') await session.bridge?.redeem(crossing, account.address);
      else await session.bridge?.selfForward(crossing);
      setDone(true);
    } catch (e) {
      setError(firstLine(e));
    } finally {
      setBusy(false);
    }
  };
  const copy = COPY[action];
  return (
    <Sheet open={crossing !== null} onOpenChange={(o) => (o ? onOpenChange(true) : close())}>
      <SheetContent data-testid={`${action}-sheet`}>
        <SheetTitle>{copy.title}</SheetTitle>
        {crossing && <SheetDescription>{describe(action, crossing)}</SheetDescription>}
        {error && (
          <Alert variant="bad" data-testid={`${action}-error`}>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        <WalletPicker />
        {crossing && !done && (
          <div className="flex flex-col gap-4">
            <KvRow
              label="amount"
              value={`${fmt(BigInt(crossing.amount), PARAMS.DECIMALS)} ${PARAMS.TOKEN_SYMBOL}${action === 'redeem' || crossing.kind === 1 ? ' → YACA' : ''}`}
            />
            {action === 'redeem' && (
              <KvRow
                label="to"
                value={account.address ? shortAddress(account.address) : 'connect a wallet'}
              />
            )}
            <Button
              variant="uv"
              disabled={!account.isConnected || busy}
              onClick={() => void go()}
              data-testid={`${action}-go`}
            >
              {busy ? 'Waiting for your wallet…' : copy.go}
            </Button>
          </div>
        )}
        {done && (
          <div className="flex flex-col gap-4" data-testid={`${action}-done`}>
            <p className="text-lg font-semibold">{copy.done}</p>
            <Button variant="primary" onClick={close}>
              Done
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
