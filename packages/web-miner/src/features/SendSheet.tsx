import { useAtomValue } from 'jotai';
import { useState } from 'react';
import { PARAMS } from '../../../miner-core/src/generated/params.ts';
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Button,
  ExternalLink,
  Input,
  KvRow,
  Label,
  RadioCards,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from '../../../ui/src/index.ts';
import { links } from '../explorer';
import { amount as fmt, shortAddress } from '../lib/format';
import type { Session } from '../session';
import { minerAtom } from '../state';
import { type Draft, type Mode, review, type Snapshot } from './withdraw-form';

/** The two ways out of the private balance, each stating its consequence where it is chosen. */
const MODES = [
  {
    value: 'private' as Mode,
    label: 'Privately',
    description: 'The recipient gets notes. Nothing about this transfer is public.',
  },
  {
    value: 'public' as Mode,
    label: 'Publicly',
    description: 'Withdraws to a public balance. The amount and the address are readable by anyone.',
  },
];

type Step =
  | { kind: 'form' }
  | { kind: 'review'; snap: Snapshot; known: boolean }
  | { kind: 'sent'; snap: Snapshot; block: number; txHash: string };

function Form({
  draft,
  setDraft,
  balance,
  busy,
  onReview,
}: {
  draft: Draft;
  setDraft: (d: Draft) => void;
  balance: bigint;
  busy: boolean;
  onReview: () => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <Label htmlFor="amount">Amount</Label>
        <div className="flex items-center gap-2 rounded-[8px] border border-line-2 px-3.5 py-2.5 focus-within:border-ink-3">
          <Input
            id="amount"
            value={draft.amount}
            onChange={(e) => setDraft({ ...draft, amount: e.target.value })}
            inputMode="decimal"
            placeholder="0.00"
            className="h-auto flex-1 border-0 bg-transparent p-0 font-mono text-2xl font-semibold tracking-[-0.02em] focus-visible:ring-0"
            data-testid="withdraw-amount"
          />
          <span className="font-mono text-xs text-ink-3">{PARAMS.TOKEN_SYMBOL}</span>
          <button
            type="button"
            className="rounded-sm border border-uv px-2 py-0.5 font-mono text-2xs uppercase tracking-[0.06em] text-uv-2"
            // Full precision: the display form truncates to four places and would leave dust behind.
            onClick={() => setDraft({ ...draft, amount: fmt(balance, PARAMS.DECIMALS, PARAMS.DECIMALS) })}
            data-testid="withdraw-max"
          >
            max
          </button>
        </div>
      </div>
      <div className="flex flex-col gap-1">
        <Label htmlFor="to">To</Label>
        <Input
          id="to"
          value={draft.to}
          onChange={(e) => setDraft({ ...draft, to: e.target.value })}
          placeholder="0x…"
          autoComplete="off"
          spellCheck={false}
          className="font-mono"
          data-testid="withdraw-to"
        />
      </div>
      <RadioCards
        value={draft.mode}
        onChange={(mode) => setDraft({ ...draft, mode })}
        options={MODES}
        aria-label="how to send"
      />
      <div className="flex items-center gap-3">
        <Button variant="primary" disabled={busy} onClick={onReview} data-testid="withdraw-review">
          {busy ? 'Checking…' : 'Review'}
        </Button>
        <span className="text-xs text-ink-3">
          Mining pauses while the transfer is proved in your browser.
        </span>
      </div>
    </div>
  );
}

function Review({
  snap,
  known,
  balance,
  busy,
  onSend,
  onBack,
}: {
  snap: Snapshot;
  known: boolean;
  balance: bigint;
  busy: boolean;
  onSend: () => void;
  onBack: () => void;
}) {
  const to = snap.to.toString();
  const after = balance - snap.amount;
  return (
    <div className="flex flex-col gap-4">
      <p className="label-mono">send · step 2 of 2</p>
      <div className="flex items-center justify-between rounded-[8px] border border-line px-3.5 py-2.5 font-mono">
        <span className="text-2xl font-semibold tracking-[-0.02em]">
          {snap.display} <span className="text-xs font-normal text-ink-3">{PARAMS.TOKEN_SYMBOL}</span>
        </span>
        <span className="text-2xs text-ink-3">{snap.mode === 'private' ? 'privately' : 'publicly'}</span>
      </div>
      <div>
        <KvRow label="to" value={<span title={to}>{shortAddress(to)}</span>} />
        <KvRow
          label="from"
          value={`this account's private balance · ${fmt(balance, PARAMS.DECIMALS)} → ${fmt(after, PARAMS.DECIMALS)}`}
        />
        <KvRow label="fee" value="paid by the sponsor" />
      </div>
      {snap.mode === 'public' && (
        <Alert variant="warn" data-testid="public-warning">
          <AlertTitle>This will be public.</AlertTitle>
          <AlertDescription>
            {shortAddress(to)} receives {snap.display} {PARAMS.TOKEN_SYMBOL} into a public balance. The amount
            and the address are readable by anyone, forever.
          </AlertDescription>
        </Alert>
      )}
      {snap.mode === 'private' && !known && (
        <Alert variant="warn" data-testid="unknown-recipient">
          <AlertDescription>
            Nothing on the chain or in this wallet knows that address as a contract. A private transfer to it
            would mint notes nobody could read. This is a warning, not proof that a known recipient syncs.
          </AlertDescription>
        </Alert>
      )}
      <div className="flex gap-3">
        <Button variant="uv" disabled={busy} onClick={onSend} data-testid="withdraw-send">
          {busy ? 'Proving and sending…' : `Send ${snap.mode === 'private' ? 'privately' : 'publicly'}`}
        </Button>
        <Button variant="ghost" disabled={busy} onClick={onBack}>
          Back
        </Button>
      </div>
      <p className="text-xs text-ink-3">
        Mining pauses while the transfer is proved in your browser, about 20 s.
      </p>
    </div>
  );
}

function SentView({
  step,
  balance,
  onDone,
}: {
  step: Extract<Step, { kind: 'sent' }>;
  balance: bigint;
  onDone: () => void;
}) {
  const miner = useAtomValue(minerAtom);
  const to = step.snap.to.toString();
  return (
    <div className="flex flex-col gap-4" data-testid="withdraw-sent">
      <p className="label-mono">send</p>
      <p className="text-lg font-semibold">Sent.</p>
      <div className="flex items-center justify-between rounded-[8px] border border-ok/40 px-3.5 py-2.5 font-mono">
        <span className="text-2xl font-semibold tracking-[-0.02em]">
          {step.snap.display} <span className="text-xs font-normal text-ink-3">{PARAMS.TOKEN_SYMBOL}</span>
        </span>
        <span className="text-2xs text-ok">
          ✓ in block{' '}
          <ExternalLink href={links.block(step.block)} full={String(step.block)} data-testid="sent-block">
            {step.block.toLocaleString('en-US')}
          </ExternalLink>
        </span>
      </div>
      <div>
        <KvRow label="to" value={<span title={to}>{shortAddress(to)}</span>} />
        <KvRow label="how" value={step.snap.mode === 'private' ? 'privately' : 'publicly'} />
        <KvRow
          label="transaction"
          value={
            <ExternalLink href={links.tx(step.txHash)} full={step.txHash} data-testid="sent-tx">
              {shortAddress(step.txHash)}
            </ExternalLink>
          }
        />
        <KvRow
          label="balance now"
          value={`${fmt(balance, PARAMS.DECIMALS)} ${PARAMS.TOKEN_SYMBOL} · private`}
        />
      </div>
      <div className="flex items-center gap-3">
        <Button variant="primary" onClick={onDone}>
          Done
        </Button>
        <span className="text-xs text-ink-3">
          {miner.phase === 'mining' ? 'Mining resumed.' : 'Mining is paused.'}
        </span>
      </div>
    </div>
  );
}

/** Form → review (what will be public, the snapshot) → sent. The send uses the snapshot only. */
export function SendSheet({
  session,
  self,
  balance,
  open,
  onOpenChange,
}: {
  session: Session;
  self: string;
  balance: bigint;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [draft, setDraft] = useState<Draft>({ to: '', amount: '', mode: 'private' });
  const [step, setStep] = useState<Step>({ kind: 'form' });
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const reset = () => {
    setStep({ kind: 'form' });
    setError(undefined);
    setDraft({ to: '', amount: '', mode: 'private' });
  };
  const toReview = async () => {
    setBusy(true);
    setError(undefined);
    try {
      const snap = await review(draft, self, balance, PARAMS.DECIMALS);
      const known = snap.mode === 'private' ? await session.recipientKnown(snap.to) : true;
      setStep({ kind: 'review', snap, known });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };
  const send = async (snap: Snapshot) => {
    setBusy(true);
    setError(undefined);
    try {
      const sent = await session.withdraw(snap);
      setStep({ kind: 'sent', snap, ...sent });
    } catch (e) {
      setError(e instanceof Error ? (e.message.split('\n')[0] ?? '') : String(e));
    } finally {
      setBusy(false);
    }
  };
  const close = () => {
    reset();
    onOpenChange(false);
  };
  return (
    <Sheet open={open} onOpenChange={(o) => (o ? onOpenChange(true) : close())}>
      <SheetContent data-testid="withdraw-sheet">
        <SheetTitle>Send</SheetTitle>
        <SheetDescription>
          From this account's private balance of {fmt(balance, PARAMS.DECIMALS)} {PARAMS.TOKEN_SYMBOL}.
        </SheetDescription>
        {error && (
          <Alert variant="bad" data-testid="withdraw-error">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        {step.kind === 'form' && (
          <Form
            draft={draft}
            setDraft={setDraft}
            balance={balance}
            busy={busy}
            onReview={() => void toReview()}
          />
        )}
        {step.kind === 'review' && (
          <Review
            snap={step.snap}
            known={step.known}
            balance={balance}
            busy={busy}
            onSend={() => void send(step.snap)}
            onBack={() => setStep({ kind: 'form' })}
          />
        )}
        {step.kind === 'sent' && <SentView step={step} balance={balance} onDone={close} />}
      </SheetContent>
    </Sheet>
  );
}
