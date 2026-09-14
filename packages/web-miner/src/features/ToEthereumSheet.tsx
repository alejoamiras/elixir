// Bridge to Ethereum: the figure and the address with the three stations (burned here, proven
// to Ethereum within the hour, claimed there by the holder), the review with the ETA and what is
// public, then "On its way." with the burn's block once the journal has it.
import { useAtomValue } from 'jotai';
import { useState } from 'react';
import type { Crossing } from '../../../bridge/src/journal.ts';
import { PARAMS } from '../../../miner-core/src/generated/params.ts';
import {
  Alert,
  AlertDescription,
  AmountBlock,
  Button,
  Input,
  KvRow,
  Label,
  Note,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
  Stepper,
} from '../../../ui/src/index.ts';
import { chainName } from '../bridge/copy';
import { bridgeRecord } from '../bridge/env';
import { type EthDraft, type EthSnapshot, reviewExit } from '../bridge/forms';
import { amount as fmt, shortAddress } from '../lib/format';
import type { Session } from '../session';
import { journalAtom } from '../state';
import { AmountInput } from './AmountInput';

type Step =
  | { kind: 'form' }
  | { kind: 'review'; snap: EthSnapshot }
  | { kind: 'sent'; snap: EthSnapshot; crossing?: Crossing };

const money = (raw: bigint) => `${fmt(raw, PARAMS.DECIMALS)} ${PARAMS.TOKEN_SYMBOL}`;

function Form({
  draft,
  setDraft,
  balance,
  onReview,
}: {
  draft: EthDraft;
  setDraft: (d: EthDraft) => void;
  balance: bigint;
  onReview: () => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <p className="label-mono">bridge to ethereum · step 1 of 2</p>
      <AmountInput
        id="exit-amount"
        value={draft.amount}
        onChange={(amount) => setDraft({ ...draft, amount })}
        unit={PARAMS.TOKEN_SYMBOL}
        max={fmt(balance, PARAMS.DECIMALS, PARAMS.DECIMALS)}
        data-testid="exit-amount"
      />
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="exit-to" className="text-sm text-ink-2">
          To · an Ethereum address
        </Label>
        <Input
          id="exit-to"
          value={draft.to}
          onChange={(e) => setDraft({ ...draft, to: e.target.value })}
          placeholder="0x…"
          autoComplete="off"
          spellCheck={false}
          className="font-mono"
          data-testid="exit-to"
        />
      </div>
      <Stepper
        steps={[
          { id: 'burn', label: 'burned here, privately', state: 'pending', right: '20 s' },
          { id: 'prove', label: 'proven to Ethereum', state: 'pending', right: 'within the hour' },
          { id: 'claim', label: 'claimed on Ethereum by you', state: 'pending', right: 'one transaction' },
        ]}
      />
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="primary" onClick={onReview} data-testid="exit-review">
          Review
        </Button>
      </div>
    </div>
  );
}

function Review({
  snap,
  busy,
  onSend,
  onBack,
}: {
  snap: EthSnapshot;
  busy: boolean;
  onSend: () => void;
  onBack: () => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <p className="label-mono">bridge to ethereum · step 2 of 2</p>
      <AmountBlock
        value={snap.display}
        unit={PARAMS.TOKEN_SYMBOL}
        aside={`→ ${snap.display} YACA`}
        tone="quiet"
      />
      <div>
        <KvRow label="to" value={`Ξ ${shortAddress(snap.to)}`} />
        <KvRow label="fees" value="none here · gas on Ethereum when you claim" />
        <KvRow label="claimable" value="within the hour, once proven to Ethereum" />
      </div>
      <Note title="Public on Ethereum." tone="warn" data-testid="exit-public">
        {shortAddress(snap.to)} receives {snap.display} YACA; anyone can see that.
      </Note>
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="uv" disabled={busy} onClick={onSend} data-testid="exit-send">
          {busy ? 'Proving and sending…' : 'Bridge to Ethereum'}
        </Button>
        <Button variant="ghost" disabled={busy} onClick={onBack}>
          Back
        </Button>
      </div>
    </div>
  );
}

function Sent({
  snap,
  sent,
  balance,
  onDone,
}: {
  snap: EthSnapshot;
  sent?: Crossing;
  balance: bigint;
  onDone: () => void;
}) {
  const journal = useAtomValue(journalAtom);
  const live = (sent && journal.find((c) => c.id === sent.id)) ?? sent;
  const block = live?.block
    ? `✓ burned in block ${live.block.toLocaleString('en-US')}`
    : '✓ burned · waiting for a block';
  return (
    <div className="flex flex-col gap-4" data-testid="exit-sent">
      <div>
        <span className="label-mono">bridge to ethereum</span>
        <SheetTitle className="mt-1.5 text-[22px] leading-[1.2] tracking-[-0.02em]">On its way.</SheetTitle>
      </div>
      <AmountBlock
        value={snap.display}
        unit={PARAMS.TOKEN_SYMBOL}
        aside={<span className="text-ok">{block}</span>}
        tone="ok"
      />
      <Stepper
        steps={[
          { id: 'burn', label: 'burned here, privately', state: 'done' },
          {
            id: 'prove',
            label: 'being proven to Ethereum',
            state: 'active',
            right: live?.epoch ? `epoch ${live.epoch}` : undefined,
            detail: 'Usually within the hour; safe from then on.',
          },
          {
            id: 'claim',
            label: `claim on Ethereum · ${shortAddress(snap.to)}`,
            state: 'pending',
            right: 'from the wallet page',
          },
        ]}
      />
      <KvRow label="balance now" value={`${money(balance)} · private`} />
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="primary" onClick={onDone}>
          Done
        </Button>
        <span className="text-xs text-ink-3">
          Progress stays in Wallet; claim it there once it is proven.
        </span>
      </div>
    </div>
  );
}

export function ToEthereumSheet({
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
  const [draft, setDraft] = useState<EthDraft>({ amount: '', to: '' });
  const [step, setStep] = useState<Step>({ kind: 'form' });
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const close = () => {
    setStep({ kind: 'form' });
    setError(undefined);
    setDraft({ amount: '', to: '' });
    onOpenChange(false);
  };
  const toReview = () => {
    setError(undefined);
    try {
      setStep({ kind: 'review', snap: reviewExit(draft, balance, PARAMS.DECIMALS) });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };
  const send = async (snap: EthSnapshot) => {
    setBusy(true);
    setError(undefined);
    try {
      const crossing = (await session.bridge?.exitToL1(snap.amount, snap.to)) ?? undefined;
      setStep({ kind: 'sent', snap, crossing });
    } catch (e) {
      setError(e instanceof Error ? (e.message.split('\n')[0] ?? '') : String(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Sheet open={open} onOpenChange={(o) => (o ? onOpenChange(true) : close())}>
      <SheetContent data-testid="to-ethereum-sheet">
        {step.kind !== 'sent' && (
          <>
            <SheetTitle className="text-[22px] leading-[1.2] tracking-[-0.02em]">
              Bridge to Ethereum
            </SheetTitle>
            <SheetDescription className="sr-only">
              Burned here privately, claimed as YACA on {chainName(bridgeRecord()?.chainId)}.
            </SheetDescription>
          </>
        )}
        {error && (
          <Alert variant="bad" data-testid="to-ethereum-error">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        {step.kind === 'form' && (
          <Form draft={draft} setDraft={setDraft} balance={balance} onReview={toReview} />
        )}
        {step.kind === 'review' && (
          <Review
            snap={step.snap}
            busy={busy}
            onSend={() => void send(step.snap)}
            onBack={() => setStep({ kind: 'form' })}
          />
        )}
        {step.kind === 'sent' && (
          <Sent snap={step.snap} sent={step.crossing} balance={balance} onDone={close} />
        )}
      </SheetContent>
    </Sheet>
  );
}
