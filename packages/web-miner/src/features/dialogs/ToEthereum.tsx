// Bridge to Ethereum. A pasted recipient is shown in full, with its warning, because a wrong
// address here cannot be undone; the connected wallet is the default. The dialog ends at the send:
// the Wallet's row carries the crossing from there.
import { useAtomValue } from 'jotai';
import { type ComponentProps, useEffect, useState } from 'react';
import { useAccount } from 'wagmi';
import type { Crossing } from '../../../../bridge/src/journal.ts';
import { PARAMS } from '../../../../miner-core/src/generated/params.ts';
import { ownVersionName } from '../../../../site/src/browser/version-name.ts';
import { Alert, AlertDescription, AmountField, Stepper, Textarea } from '../../../../ui/src/index.ts';
import { type EthSnapshot, ethRefusal, reviewExit } from '../../bridge/forms';
import { amount as fmt, shortAddress } from '../../lib/format';
import type { Session } from '../../session';
import { journalAtom } from '../../state';
import { amountRefusal } from '../withdraw-form';
import {
  Actions,
  AmountBelow,
  Back,
  Foot,
  firstLine,
  hhmm,
  Primary,
  Quiet,
  Row,
  Rows,
  seconds,
  TxDialog,
  useElapsed,
  useLive,
  useOpening,
} from './Frame';
import { ConnectWallet, chain, WalletChip } from './Wallet';

const SYM = PARAMS.TOKEN_SYMBOL;
const money = (raw: bigint) => `${fmt(raw, PARAMS.DECIMALS)} ${SYM}`;

type Step =
  | { kind: 'form' }
  | { kind: 'how' }
  | { kind: 'connect' }
  | { kind: 'proving'; snap: EthSnapshot; since: number }
  | { kind: 'sent'; snap: EthSnapshot; crossing?: Crossing; provedMs: number };

/** The recipient: the connected wallet, or an address the user pasted, shown in full. */
function Recipient({
  pasted,
  text,
  setText,
  refusal,
  onPaste,
  onWallet,
  onConnect,
  disabled,
}: {
  pasted: boolean;
  text: string;
  setText: (t: string) => void;
  refusal: string | null;
  onPaste: () => void;
  onWallet: () => void;
  onConnect: () => void;
  disabled: boolean;
}) {
  const account = useAccount();
  const connected = account.isConnected && account.address !== undefined;
  // The pasted address is the connected wallet's own: nothing to warn about.
  const own = connected && text.trim().toLowerCase() === account.address?.toLowerCase();
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-3 text-[13px]">
        <span className="text-ink-2">To</span>
        {connected ? (
          <Quiet onClick={pasted ? onWallet : onPaste} disabled={disabled} data-testid="exit-to-change">
            {pasted ? 'Use my wallet instead' : 'Change'}
          </Quiet>
        ) : (
          <Quiet onClick={onConnect} disabled={disabled} data-testid="exit-connect">
            Connect wallet
          </Quiet>
        )}
      </div>
      {!pasted && connected ? (
        <WalletChip />
      ) : (
        <>
          <Textarea
            id="exit-to"
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={2}
            placeholder="0x… an Ethereum address"
            autoComplete="off"
            spellCheck={false}
            aria-invalid={refusal !== null || undefined}
            disabled={disabled}
            className="min-h-0 resize-none text-xs leading-[1.4] break-all"
            data-testid="exit-to"
          />
          {refusal && (
            <span className="font-mono text-2xs text-bad" data-testid="to-refusal">
              {refusal}
            </span>
          )}
          {text.trim() !== '' && refusal === null && (
            <>
              {connected && !own && (
                <span className="self-start rounded-sm border border-warn/50 px-1.5 py-0.5 font-mono text-[10px] text-warn">
                  pasted · not your connected wallet
                </span>
              )}
              <p className="text-xs text-warn" data-testid="exit-pasted">
                Check every character. A bridge can't be recalled; YACA sent to a wrong address is lost.
              </p>
            </>
          )}
        </>
      )}
    </div>
  );
}

function Form({
  balance,
  onSend,
  onHow,
  onConnect,
}: {
  balance: bigint;
  onSend: (snap: EthSnapshot) => void;
  onHow: () => void;
  onConnect: () => void;
}) {
  const account = useAccount();
  const [amount, setAmount] = useState('');
  const [text, setText] = useState('');
  const [pasted, setPasted] = useState(false);
  const [refusal, setRefusal] = useState<string | null>(null);
  const [error, setError] = useState<string>();
  const usingWallet = !pasted && account.isConnected && account.address !== undefined;
  const to = usingWallet ? (account.address as string) : text;
  const amountLine = amountRefusal(amount, balance, PARAMS.DECIMALS);
  const [tried, setTried] = useState(false);
  const touched = amount !== '' || tried;
  const submit = () => {
    setError(undefined);
    setTried(true);
    const bad = usingWallet ? null : ethRefusal(text);
    setRefusal(bad);
    if (bad !== null || amountLine !== null || to.trim() === '') {
      if (to.trim() === '' && bad === null) setRefusal('Enter an Ethereum address.');
      return;
    }
    try {
      onSend(reviewExit({ amount, to }, balance, PARAMS.DECIMALS));
    } catch (e) {
      setError(firstLine(e));
    }
  };
  const who =
    to.trim() && (usingWallet || ethRefusal(text) === null) ? shortAddress(to.trim()) : 'the address';
  return (
    <>
      {error && (
        <Alert variant="bad" data-testid="to-ethereum-error">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <AmountField
        id="exit-amount"
        value={amount}
        onChange={setAmount}
        unit={SYM}
        max={fmt(balance, PARAMS.DECIMALS, PARAMS.DECIMALS)}
        invalid={touched && amountLine !== null}
        below={<AmountBelow line={touched ? amountLine : null} balance={money(balance)} />}
        data-testid="exit-amount"
      />
      <Recipient
        pasted={pasted}
        text={text}
        setText={(t) => {
          setText(t);
          setRefusal(null);
        }}
        refusal={refusal}
        onPaste={() => setPasted(true)}
        onWallet={() => setPasted(false)}
        onConnect={onConnect}
        disabled={false}
      />
      <Rows>
        <Row label="Arrives">usually within the hour; then you claim it there</Row>
        <Row label="Fee">none here · gas in ETH when you claim, from the wallet that claims</Row>
        <Row label="Visible on Ethereum">the amount and {who}; not this account</Row>
      </Rows>
      <Actions quiet={<Quiet onClick={onHow}>How it works</Quiet>}>
        <Primary disabled={touched && amountLine !== null} onClick={submit} data-testid="exit-send">
          Bridge{amount.trim() && amountLine === null ? ` ${amount.trim()} ${SYM}` : ''}
        </Primary>
      </Actions>
    </>
  );
}

/** The four stages, from the quiet link. */
function How({ onBack }: { onBack: () => void }) {
  const v = ownVersionName();
  return (
    <>
      <Back onBack={onBack} />
      <Stepper
        data-testid="exit-how"
        steps={[
          {
            id: 'prove',
            label: 'Proving privately',
            state: 'pending',
            right: 'about 20 s',
            detail: 'In your browser; mining pauses meanwhile.',
          },
          { id: 'send', label: 'Sent', state: 'pending', right: 'a block' },
          {
            id: 'reach',
            label: 'Reaching Ethereum',
            state: 'pending',
            right: 'usually within the hour',
            detail: `${v} must prove the epoch within its deadline, about 40 min after the send. If it doesn't, the balance comes back here.`,
          },
          {
            id: 'claim',
            label: 'Claim on Ethereum',
            state: 'pending',
            right: 'your wallet',
            detail: `With a wallet on ${chain()}; it pays the gas in ETH. The YACA is minted at the address you chose here.`,
          },
        ]}
      />
    </>
  );
}

function Proving({ since }: { since: number }) {
  const elapsed = useElapsed(since);
  return (
    <>
      <Stepper
        data-testid="exit-proving"
        steps={[
          {
            id: 'prove',
            label: 'Proving privately',
            state: 'active',
            right: elapsed === undefined ? undefined : seconds(elapsed),
            detail: 'In your browser; Presto proves only mining work.',
          },
          { id: 'send', label: 'Sent', state: 'pending' },
          { id: 'reach', label: 'Reaching Ethereum', state: 'pending', right: 'usually within the hour' },
          { id: 'claim', label: 'Claim on Ethereum', state: 'pending' },
        ]}
      />
      <Foot>Keep this tab open while it proves, about 20 s.</Foot>
    </>
  );
}

function Sent({ step, onDone }: { step: Extract<Step, { kind: 'sent' }>; onDone: () => void }) {
  const journal = useAtomValue(journalAtom);
  const live = (step.crossing && journal.find((c) => c.id === step.crossing?.id)) ?? step.crossing;
  const v = ownVersionName();
  return (
    <div className="flex flex-col gap-4" data-testid="exit-sent">
      <Stepper
        steps={[
          {
            id: 'sent',
            label: 'Proved and sent',
            state: 'done',
            right: live?.block ? `block ${live.block.toLocaleString('en-US')}` : 'waiting for a block',
          },
          {
            id: 'reach',
            label: 'Reaching Ethereum',
            state: 'active',
            right: 'usually within the hour',
            detail: live?.proofDeadline
              ? `${v} must prove it by ${hhmm(live.proofDeadline)}. If it doesn't, the balance comes back here.`
              : `${v} must prove it in time. If it doesn't, the balance comes back here.`,
          },
          {
            id: 'claim',
            label: 'Claim on Ethereum',
            state: 'pending',
            detail: `With a wallet on ${chain()}; it pays the gas in ETH.`,
          },
        ]}
      />
      <Foot>
        You can close this. Wallet shows the progress and a <b className="text-ink-2">Claim</b> button when
        it's ready.
      </Foot>
      <Actions>
        <Primary variant="primary" onClick={onDone}>
          Done
        </Primary>
      </Actions>
    </div>
  );
}

function ToEthereumRun({
  session,
  balance,
  open,
  onOpenChange,
}: {
  session: Session;
  balance: bigint;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const account = useAccount();
  const [step, setStep] = useState<Step>({ kind: 'form' });
  const [error, setError] = useState<string>();
  const live = useLive(open);
  const close = () => onOpenChange(false);
  const connected = account.isConnected && account.address !== undefined;
  // The wallet picked from the form's own "Connect wallet" becomes the recipient as it connects.
  useEffect(() => {
    if (step.kind === 'connect' && connected) setStep({ kind: 'form' });
  }, [step.kind, connected]);
  const send = async (snap: EthSnapshot) => {
    if (!live()) return;
    const since = Date.now();
    setError(undefined);
    setStep({ kind: 'proving', snap, since });
    try {
      const crossing = (await session.bridge?.exitToL1(snap.amount, snap.to)) ?? undefined;
      setStep({ kind: 'sent', snap, crossing, provedMs: Date.now() - since });
    } catch (e) {
      setError(firstLine(e));
      setStep({ kind: 'form' });
    }
  };
  const title = titleOf(step);
  const formStays = step.kind === 'form' || step.kind === 'how' || step.kind === 'connect';
  return (
    <TxDialog
      open={open}
      onOpenChange={(o) => !o && close()}
      eyebrow={step.kind === 'how' ? 'bridge · how it works' : 'bridge'}
      title={title}
      body={step.kind === 'connect' ? 'The wallet the YACA goes to.' : undefined}
      locked={step.kind === 'proving'}
      data-testid="to-ethereum-dialog"
    >
      {error && step.kind === 'form' && (
        <Alert variant="bad" data-testid="to-ethereum-error">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {formStays && (
        // The form stays mounted under the other screens: its draft comes back untouched.
        <div className={step.kind === 'form' ? 'contents' : 'hidden'}>
          <Form
            balance={balance}
            onSend={(s) => void send(s)}
            onHow={() => setStep({ kind: 'how' })}
            onConnect={() => setStep({ kind: 'connect' })}
          />
        </div>
      )}
      {step.kind === 'how' && <How onBack={() => setStep({ kind: 'form' })} />}
      {step.kind === 'connect' && <ConnectWallet onCancel={() => setStep({ kind: 'form' })} />}
      {step.kind === 'proving' && <Proving since={step.since} />}
      {step.kind === 'sent' && <Sent step={step} onDone={close} />}
    </TxDialog>
  );
}

const titleOf = (step: Step): string => {
  if (step.kind === 'how') return 'What happens to what you bridge.';
  if (step.kind === 'connect') return 'Connect a wallet.';
  if (step.kind === 'proving') return `Bridging ${step.snap.display} ${SYM}.`;
  if (step.kind === 'sent') return `${step.snap.display} ${SYM} on its way.`;
  return 'Bridge to Ethereum.';
};

/** Bridge to Ethereum, one run per opening. */
export function ToEthereumDialog(props: ComponentProps<typeof ToEthereumRun>) {
  return <ToEthereumRun key={useOpening(props.open)} {...props} />;
}
