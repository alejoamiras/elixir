// Bridge from Ethereum: connect the wallet that holds the YACA, then one screen — the wallet chip
// with what it holds, the amount, the three rows, the button with the amount — then the wallet's
// prompt as a step and the crossing's stations; the Wallet's row claims it here.
import { useAtomValue } from 'jotai';
import { type ComponentProps, useState } from 'react';
import type { Hex } from 'viem';
import { useAccount } from 'wagmi';
import type { Crossing } from '../../../../bridge/src/journal.ts';
import { PARAMS } from '../../../../miner-core/src/generated/params.ts';
import { ownVersionName } from '../../../../site/src/browser/version-name.ts';
import {
  Alert,
  AlertDescription,
  AmountField,
  ExternalLink,
  Note,
  Stepper,
} from '../../../../ui/src/index.ts';
import { dayOf } from '../../bridge/copy';
import { migrationRecord, nextVersionName } from '../../bridge/env';
import { reviewAmount } from '../../bridge/forms';
import type { BridgeSession } from '../../bridge/session';
import { l1Links } from '../../explorer';
import { amount as fmt, shortAddress } from '../../lib/format';
import type { Session } from '../../session';
import { bridgeAtom, journalAtom } from '../../state';
import { amountRefusal } from '../withdraw-form';
import { Actions, Back, Foot, firstLine, Primary, Quiet, Row, Rows, TxDialog, useOpening } from './Frame';
import {
  ConnectWallet,
  chain,
  noEth,
  useWalletChain,
  useWalletName,
  useYacaBalance,
  WalletChip,
  WrongNetwork,
  YacaAvailable,
} from './Wallet';

type Step = { kind: 'form' } | { kind: 'how' } | { kind: 'done'; display: string; crossing?: Crossing };

/** Before an announced upgrade a deposit lands on a version about to end; closed deposits say where to go. */
function Standing() {
  const view = useAtomValue(bridgeAtom);
  const m = migrationRecord();
  const v = ownVersionName();
  const next = nextVersionName(view.canonical);
  const day = m ? dayOf(BigInt(m.expectedFlipAt)) : undefined;
  if (view.standing?.depositsClosed)
    return (
      <Note title={`Deposits into ${v} are closed for good.`} tone="warn" data-testid="deposits-closed">
        {day
          ? `Aztec upgrades around ${day} and Yacana closed ${v}'s deposits ahead of it.`
          : `Yacana closed ${v}'s deposits ahead of the upgrade.`}{' '}
        Bridge from Ethereum on {next}, at yacana.network, once it opens.
      </Note>
    );
  if (m && view.verdict.kind !== 'flipped')
    return (
      <Note title={`Aztec upgrades to ${next} around ${day}.`} tone="warn" data-testid="deposit-preflip">
        A deposit now lands on {v} and would need sending ahead afterwards. Unless you need it here now,
        bridge after the upgrade, at yacana.network.
      </Note>
    );
  return null;
}

function Notes({ error, funds }: { error?: string; funds: string | null }) {
  const account = useAccount();
  return (
    <>
      {error && (
        <Alert variant="bad" data-testid="deposit-error">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {funds && account.address && (
        <Note title={funds} tone="warn" data-testid="payer-no-eth">
          Add some to {shortAddress(account.address)}, then bridge. The YACA stays in your wallet.
        </Note>
      )}
    </>
  );
}

function Form({
  session,
  resume,
  onWaiting,
  onSent,
  onHow,
}: {
  session: Session;
  resume?: Crossing;
  /** The wallet is being asked: the dialog locks and says so. */
  onWaiting: (waiting: boolean) => void;
  onSent: (display: string, crossing?: Crossing) => void;
  onHow: () => void;
}) {
  const account = useAccount();
  const view = useAtomValue(bridgeAtom);
  const wallet = useWalletName();
  const net = useWalletChain();
  const yaca = useYacaBalance(account.address);
  const [text, setText] = useState(
    resume ? fmt(BigInt(resume.amount), PARAMS.DECIMALS, PARAMS.DECIMALS) : '',
  );
  const [error, setError] = useState<string>();
  const [funds, setFunds] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [waiting, setWaiting] = useState(false);
  const closed = Boolean(view.standing?.depositsClosed);
  const ceiling = yaca ?? (1n << 128n) - 1n;
  const line = amountRefusal(text, ceiling, PARAMS.DECIMALS);
  const touched = text !== '';
  const switchNetwork = async () => {
    setBusy(true);
    try {
      await net.switchTo();
    } catch (e) {
      setError(firstLine(e));
    } finally {
      setBusy(false);
    }
  };
  const wait = (w: boolean) => {
    setWaiting(w);
    onWaiting(w);
  };
  const deposit = async (address: Hex, bridge: BridgeSession) => {
    try {
      const { amount, display } = reviewAmount(text, ceiling, PARAMS.DECIMALS);
      // The ETH for the gas is read here first, so "no ETH" is the page's word, not the wallet's error.
      const refused = noEth(await bridge.payerFunds(address, { kind: 'deposit', amount }), wallet);
      if (refused) return setFunds(refused);
      onSent(display, await bridge.deposit(amount, () => wait(true), resume));
    } catch (e) {
      setError(firstLine(e));
    } finally {
      wait(false);
    }
  };
  const go = () => {
    setError(undefined);
    setFunds(null);
    if (net.wrong) return void switchNetwork();
    if (line === null && account.address && session.bridge) void deposit(account.address, session.bridge);
  };
  if (waiting) return <Waiting />;
  const amountWord = line === null && text.trim() ? ` ${text.trim()} YACA` : '';
  const canGo = !closed && !busy && (net.wrong || (line === null && !!account.address));
  return (
    <>
      <WalletChip aside={<YacaAvailable yaca={yaca} />} />
      <Standing />
      <Notes error={error} funds={funds} />
      <AmountField
        id="deposit-amount"
        value={text}
        onChange={setText}
        unit="YACA"
        max={yaca === undefined ? undefined : fmt(yaca, PARAMS.DECIMALS, PARAMS.DECIMALS)}
        invalid={touched && line !== null}
        below={touched && line !== null ? <span className="text-bad">{line}</span> : undefined}
        disabled={closed}
        data-testid="deposit-amount"
      />
      <Rows>
        <Row label="Arrives" sub="one tap, no fee">
          a few minutes; then you claim it here
        </Row>
        <Row label="Fee">gas in ETH from {wallet} · none here</Row>
        <Row label="Visible on Ethereum">your wallet and the amount; not this account</Row>
      </Rows>
      {net.wrong && <WrongNetwork wallet={wallet} onChain={net.onChain} verb="bridge" />}
      <Actions quiet={<Quiet onClick={onHow}>How it works</Quiet>}>
        <Primary disabled={!canGo} onClick={go} data-testid="deposit-go">
          {net.wrong ? `Switch ${wallet} to ${chain()}` : `Bridge${amountWord}`}
        </Primary>
      </Actions>
    </>
  );
}

function How({ onBack }: { onBack: () => void }) {
  const wallet = useWalletName();
  return (
    <>
      <Back onBack={onBack} />
      <Stepper
        data-testid="deposit-how"
        steps={[
          {
            id: 'deposit',
            label: `Confirm in ${wallet}`,
            state: 'pending',
            right: 'gas in ETH',
            detail: 'One Ethereum transaction: the portal takes the YACA there and sends it across.',
          },
          { id: 'cross', label: 'Crossing to Aztec', state: 'pending', right: 'a few minutes' },
          {
            id: 'claim',
            label: 'Claim here',
            state: 'pending',
            right: 'one tap, no fee',
            detail:
              'A private transaction this page makes when you tap, about 20 s. The YACA waits until you do.',
          },
        ]}
      />
    </>
  );
}

function Waiting() {
  const wallet = useWalletName();
  return (
    <Stepper
      data-testid="deposit-waiting"
      steps={[
        {
          id: 'confirm',
          label: `Confirm in ${wallet}`,
          state: 'active',
          detail: `${wallet} asks you to confirm the deposit and shows the gas.`,
        },
        { id: 'cross', label: 'Crossing to Aztec', state: 'pending', right: 'a few minutes' },
        { id: 'claim', label: 'Claim here', state: 'pending', right: 'one tap' },
      ]}
    />
  );
}

function Done({ crossing, onDone }: { crossing?: Crossing; onDone: () => void }) {
  const wallet = useWalletName();
  const journal = useAtomValue(journalAtom);
  const live = (crossing && journal.find((c) => c.id === crossing.id)) ?? crossing;
  const tx = live?.l1TxHash;
  return (
    <div className="flex flex-col gap-4" data-testid="deposit-done">
      <Stepper
        steps={[
          {
            id: 'sent',
            label: `Sent from ${wallet}`,
            state: 'done',
            right: tx ? (
              <ExternalLink href={l1Links.tx(tx)} full={tx}>
                Etherscan ↗
              </ExternalLink>
            ) : undefined,
          },
          { id: 'cross', label: 'Crossing to Aztec', state: 'active', right: 'a few minutes' },
          { id: 'claim', label: 'Claim here', state: 'pending', right: 'one tap, no fee' },
        ]}
      />
      <Foot>
        You can close this. Wallet shows a <b className="text-ink-2">Claim</b> button when it arrives.
      </Foot>
      <Actions>
        <Primary variant="primary" onClick={onDone}>
          Done
        </Primary>
      </Actions>
    </div>
  );
}

const titleOf = (step: Step, waiting: boolean): string => {
  if (waiting) return 'Bridging from Ethereum.';
  if (step.kind === 'how') return 'What happens to what you bridge.';
  if (step.kind === 'done') return `${step.display} YACA on its way.`;
  return 'Bridge from Ethereum.';
};

function FromEthereumRun({
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
  const [step, setStep] = useState<Step>({ kind: 'form' });
  const [waiting, setWaiting] = useState(false);
  const close = () => onOpenChange(false);
  const connected = account.isConnected && account.address !== undefined;
  const screen = step.kind === 'form' ? (connected ? 'form' : 'connect') : step.kind;
  return (
    <TxDialog
      open={open}
      onOpenChange={(o) => !o && close()}
      eyebrow={step.kind === 'how' ? 'bridge · how it works' : 'bridge'}
      title={titleOf(step, waiting)}
      body={screen === 'connect' ? 'Connect the wallet that holds your YACA.' : undefined}
      locked={waiting}
      data-testid="deposit-dialog"
    >
      {screen === 'connect' && <ConnectWallet onCancel={close} />}
      {screen === 'form' && (
        <Form
          session={session}
          resume={resume}
          onWaiting={setWaiting}
          onSent={(display, crossing) => setStep({ kind: 'done', display, crossing })}
          onHow={() => setStep({ kind: 'how' })}
        />
      )}
      {screen === 'how' && <How onBack={() => setStep({ kind: 'form' })} />}
      {screen === 'done' && step.kind === 'done' && <Done crossing={step.crossing} onDone={close} />}
    </TxDialog>
  );
}

/** Bridge from Ethereum, one run per opening. */
export function FromEthereumDialog(props: ComponentProps<typeof FromEthereumRun>) {
  return <FromEthereumRun key={useOpening(props.open)} {...props} />;
}
