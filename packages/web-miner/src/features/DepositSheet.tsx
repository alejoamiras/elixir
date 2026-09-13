// From Ethereum: connect a wallet (every installed one the browser announces, by name)
// → the figure with the YACA there as its ceiling, the three stations, what is public → one
// transaction from that wallet → "On its way."; the arrival card's Claim finishes it here. Also the
// sheet a held send-ahead is forwarded or redeemed from: the same wallet pays the gas.
import { useAtomValue } from 'jotai';
import { useState } from 'react';
import type { Hex } from 'viem';
import { useAccount, useConnect, useConnectors, useDisconnect, useReadContract } from 'wagmi';
import type { Crossing } from '../../../bridge/src/journal.ts';
import { yacaAbi } from '../../../bridge/src/portal.ts';
import { PARAMS } from '../../../miner-core/src/generated/params.ts';
import {
  Alert,
  AlertDescription,
  AmountBlock,
  Button,
  ExternalLink,
  KvRow,
  Note,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
  Stepper,
} from '../../../ui/src/index.ts';
import { chainName } from '../bridge/copy';
import { bridgeRecord, migrationRecord } from '../bridge/env';
import { reviewAmount } from '../bridge/forms';
import { l1Links } from '../explorer';
import { amount as fmt, shortAddress } from '../lib/format';
import type { Session } from '../session';
import { bridgeAtom, journalAtom } from '../state';
import { AmountInput } from './AmountInput';

/** The connected account's YACA on Ethereum, read through the RPC in use every few seconds. */
function useYacaBalance(owner: Hex | undefined): bigint | undefined {
  const yaca = bridgeRecord()?.yaca as Hex | undefined;
  const { data } = useReadContract({
    address: yaca,
    abi: yacaAbi,
    functionName: 'balanceOf',
    args: owner ? [owner] : undefined,
    query: { enabled: yaca !== undefined && owner !== undefined, refetchInterval: 5_000 },
  });
  return data;
}

const chain = () => chainName(bridgeRecord()?.chainId);

/** The connected wallet as one row: the avatar, the address and the network, the YACA it holds there. */
function ConnectedWallet({
  address,
  yaca,
  onDisconnect,
}: {
  address: Hex;
  yaca: bigint | undefined;
  onDisconnect: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2" data-testid="eth-account">
      <span className="inline-flex h-[34px] items-center gap-2 rounded-md border border-line-2 pr-1 pl-3 text-[12.5px] font-medium">
        <i aria-hidden className="size-3 rounded-full bg-[linear-gradient(135deg,var(--uv),var(--warn))]" />
        <span className="font-mono">{shortAddress(address)}</span>
        <button
          type="button"
          onClick={onDisconnect}
          aria-label="Disconnect this wallet"
          title="Disconnect"
          className="ml-0.5 grid size-6 place-items-center rounded-sm text-ink-3 hover:bg-panel-2 hover:text-ink"
          data-testid="eth-disconnect"
        >
          ×
        </button>
      </span>
      <span className="whitespace-nowrap font-mono text-2xs text-ink-2">
        <span data-testid="yaca-balance">{yaca === undefined ? '…' : fmt(yaca, PARAMS.DECIMALS)}</span> YACA
        there
      </span>
    </div>
  );
}

/** The wallet picker: EIP-6963 announcements by name and icon; nothing else. */
export function WalletPicker({ yaca }: { yaca?: bigint } = {}) {
  const connectors = useConnectors();
  const { connect, isPending, error } = useConnect();
  const account = useAccount();
  const { disconnect } = useDisconnect();
  // wagmi is still asking the wallets the page connected before: no picker until it knows.
  if (account.status === 'reconnecting')
    return (
      <p className="text-xs text-ink-2" data-testid="wallet-reconnecting">
        Reconnecting your Ethereum wallet…
      </p>
    );
  if (account.isConnected && account.address)
    return <ConnectedWallet address={account.address} yaca={yaca} onDisconnect={() => disconnect()} />;
  return (
    <div className="flex flex-col gap-3" data-testid="wallet-picker">
      <div className="flex flex-wrap items-center gap-3">
        {connectors.map((c) => (
          <Button
            key={c.uid}
            variant="uv"
            disabled={isPending}
            onClick={() => connect({ connector: c })}
            data-testid="wallet-option"
          >
            {c.icon && <img src={c.icon} alt="" className="mr-2 size-4" />}
            Connect {c.name}
          </Button>
        ))}
        <span className="text-xs text-ink-3">
          {connectors.length === 0
            ? 'No Ethereum wallet is installed in this browser.'
            : 'MetaMask, Rabby, any injected wallet.'}
        </span>
      </div>
      <p className="text-xs text-ink-3">
        The wallet pays {chain()} gas and signs one transaction, the deposit. It learns nothing about this
        account. The YACA then waits here for your Claim.
      </p>
      {error && <p className="text-xs text-warn">{error.message.split('\n')[0]}</p>}
    </div>
  );
}

type Step = { kind: 'form' } | { kind: 'deposit' } | { kind: 'done'; display: string; crossing?: Crossing };

const firstLine = (e: unknown) => (e instanceof Error ? (e.message.split('\n')[0] ?? '') : String(e));
const version = () => import.meta.env.VITE_ROLLUP_VERSION;

/** Before an announced flip a deposit lands on a version about to end: the sheet says so first. */
function PreFlip() {
  const m = migrationRecord();
  const view = useAtomValue(bridgeAtom);
  if (!m || view.verdict.kind === 'flipped') return null;
  const day = new Date(Number(m.expectedFlipAt) * 1000).toISOString().slice(0, 10);
  return (
    <Note title={`Aztec V${m.toIndex} is expected around ${day}.`} tone="warn" data-testid="deposit-preflip">
      A deposit lands on V{version()} and would need sending ahead again before V{version()} stops. Deposit
      after the upgrade instead, unless you mean to use it here now.
    </Note>
  );
}

function Form({
  text,
  setText,
  ceiling,
  busy,
  disabled,
  onGo,
}: {
  text: string;
  setText: (t: string) => void;
  ceiling?: bigint;
  busy: boolean;
  disabled: boolean;
  onGo: () => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <AmountInput
        id="deposit-amount"
        value={text}
        onChange={setText}
        unit="YACA"
        max={ceiling === undefined ? undefined : fmt(ceiling, PARAMS.DECIMALS, PARAMS.DECIMALS)}
        disabled={busy}
        data-testid="deposit-amount"
      />
      <Stepper
        steps={[
          {
            id: 'deposit',
            label: 'deposit',
            state: 'pending',
            right: 'your wallet · gas',
            detail: 'One Ethereum transaction: the portal burns the YACA there and sends it across.',
          },
          { id: 'cross', label: 'crossing to Aztec', state: 'pending', right: 'minutes' },
          {
            id: 'claim',
            label: 'arrives in this account, privately',
            state: 'pending',
            right: 'on a tap',
            detail:
              'The arrival card offers a Claim: a private transaction this page makes, about 20 s, fee sponsored.',
          },
        ]}
      />
      <Note title="Public on Ethereum">Your wallet and the amount. The account that receives it is not.</Note>
      <div>
        <Button variant="uv" disabled={disabled || busy || !text} onClick={onGo} data-testid="deposit-go">
          {busy ? 'Waiting for your wallet · deposit…' : 'Deposit'}
        </Button>
      </div>
    </div>
  );
}

function Done({ display, sent, onDone }: { display: string; sent?: Crossing; onDone: () => void }) {
  const journal = useAtomValue(journalAtom);
  const live = (sent && journal.find((c) => c.id === sent.id)) ?? sent;
  const tx = live?.l1TxHash;
  return (
    <div className="flex flex-col gap-4" data-testid="deposit-done">
      <AmountBlock
        value={display}
        unit="YACA"
        aside={`→ ${display} ${PARAMS.TOKEN_SYMBOL} · private`}
        tone="quiet"
      />
      <Stepper
        steps={[
          {
            id: 'deposit',
            label: `deposited on ${chain()}`,
            state: 'done',
            right: tx ? (
              <ExternalLink href={l1Links.tx(tx)} full={tx}>
                {shortAddress(tx)}
              </ExternalLink>
            ) : undefined,
          },
          { id: 'cross', label: 'crossing to Aztec', state: 'active', right: 'minutes' },
          {
            id: 'claim',
            label: 'arrives in this account, privately',
            state: 'pending',
            right: 'on a tap',
            detail: 'Keep this tab open, or come back: the arrival card offers the Claim.',
          },
        ]}
      />
      <div>
        <Button variant="primary" onClick={onDone}>
          Done
        </Button>
      </div>
    </div>
  );
}

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
  const yaca = useYacaBalance(account.address);
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
      const { amount, display } = reviewAmount(text, (1n << 128n) - 1n, PARAMS.DECIMALS);
      setStep({ kind: 'deposit' });
      const crossing =
        (await session.bridge?.deposit(amount, (s) => setStep({ kind: s }), resume)) ?? undefined;
      setStep({ kind: 'done', display, crossing });
    } catch (e) {
      setStep({ kind: 'form' });
      setError(firstLine(e));
    }
  };
  const busy = step.kind === 'deposit';
  return (
    <Sheet open={open} onOpenChange={(o) => (o ? onOpenChange(true) : close())}>
      <SheetContent data-testid="deposit-sheet">
        <div>
          <span className="label-mono">deposit from ethereum</span>
          <SheetTitle className="mt-1.5 text-[22px] leading-[1.2] tracking-[-0.02em]">
            {step.kind === 'done' ? 'On its way.' : `YACA on ${chain()} → here, privately.`}
          </SheetTitle>
          <SheetDescription className="sr-only">
            YACA on Ethereum becomes {PARAMS.TOKEN_SYMBOL} here, privately, once you claim it.
          </SheetDescription>
        </div>
        {step.kind !== 'done' && <PreFlip />}
        {view.standing?.depositsClosed && (
          <Note title="Deposits into this version are closed." tone="warn" data-testid="deposits-closed">
            An upgrade is a day away or less; deposit on the next version once it is live.
          </Note>
        )}
        {error && (
          <Alert variant="bad" data-testid="deposit-error">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        {step.kind !== 'done' && <WalletPicker yaca={yaca} />}
        {step.kind !== 'done' && account.isConnected && (
          <Form
            text={text}
            setText={setText}
            ceiling={yaca}
            busy={busy}
            disabled={!account.isConnected || Boolean(view.standing?.depositsClosed)}
            onGo={() => void go()}
          />
        )}
        {step.kind === 'done' && <Done display={step.display} sent={step.crossing} onDone={close} />}
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
  const yaca = useYacaBalance(account.address);
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
        <SheetTitle className="text-[22px] leading-[1.2] tracking-[-0.02em]">{copy.title}</SheetTitle>
        {crossing && <SheetDescription>{describe(action, crossing)}</SheetDescription>}
        {error && (
          <Alert variant="bad" data-testid={`${action}-error`}>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        <WalletPicker yaca={yaca} />
        {crossing && !done && (
          <div className="flex flex-col gap-4">
            <AmountBlock
              value={fmt(BigInt(crossing.amount), PARAMS.DECIMALS)}
              unit={PARAMS.TOKEN_SYMBOL}
              aside={action === 'redeem' || crossing.kind === 1 ? '→ YACA' : `→ V${version()}`}
              tone="quiet"
            />
            {action === 'redeem' && (
              <KvRow
                label="to"
                value={account.address ? `Ξ ${shortAddress(account.address)}` : 'connect a wallet'}
              />
            )}
            <div>
              <Button
                variant="uv"
                disabled={!account.isConnected || busy}
                onClick={() => void go()}
                data-testid={`${action}-go`}
              >
                {busy ? 'Waiting for your wallet…' : copy.go}
              </Button>
            </div>
          </div>
        )}
        {done && (
          <div className="flex flex-col gap-4" data-testid={`${action}-done`}>
            <p className="text-lg font-semibold">{copy.done}</p>
            <div>
              <Button variant="primary" onClick={close}>
                Done
              </Button>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
