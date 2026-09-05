import { useState } from 'react';
import { PARAMS } from '../../../miner-core/src/generated/params.ts';
import {
  Alert,
  AlertDescription,
  Button,
  Input,
  KvRow,
  Label,
  Segmented,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from '../../../ui/src/index.ts';
import { amount as fmt, shortAddress } from '../lib/format';
import type { Session } from '../session';
import { type Draft, type Mode, review, type Snapshot } from './withdraw-form';

const MODES: { value: Mode; label: string }[] = [
  { value: 'private', label: 'Private' },
  { value: 'public', label: 'Public' },
];

type Step =
  | { kind: 'form' }
  | { kind: 'review'; snap: Snapshot; known: boolean }
  | { kind: 'sent'; block: number };

function Form({
  draft,
  setDraft,
  busy,
  onReview,
}: {
  draft: Draft;
  setDraft: (d: Draft) => void;
  busy: boolean;
  onReview: () => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <Label htmlFor="to">Recipient</Label>
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
      <div className="flex flex-col gap-1">
        <Label htmlFor="amount">Amount ({PARAMS.TOKEN_SYMBOL})</Label>
        <Input
          id="amount"
          value={draft.amount}
          onChange={(e) => setDraft({ ...draft, amount: e.target.value })}
          inputMode="decimal"
          placeholder="1.5"
          data-testid="withdraw-amount"
        />
      </div>
      <Segmented
        value={draft.mode}
        onChange={(mode) => setDraft({ ...draft, mode })}
        options={MODES}
        aria-label="mode"
      />
      <p className="text-xs text-ink-2">
        {draft.mode === 'private'
          ? 'Private: the recipient gets notes; nothing about this transfer is public.'
          : 'Public: the recipient and the amount are visible on chain, forever.'}
      </p>
      <Button variant="primary" disabled={busy} onClick={onReview} data-testid="withdraw-review">
        {busy ? 'Checking…' : 'Review'}
      </Button>
    </div>
  );
}

function Review({
  snap,
  known,
  busy,
  onSend,
  onBack,
}: {
  snap: Snapshot;
  known: boolean;
  busy: boolean;
  onSend: () => void;
  onBack: () => void;
}) {
  const to = snap.to.toString();
  return (
    <div className="flex flex-col gap-4">
      <div>
        <KvRow label="to" value={<span title={to}>{shortAddress(to)}</span>} />
        <KvRow label="amount" value={`${snap.display} ${PARAMS.TOKEN_SYMBOL}`} />
        <KvRow label="mode" value={snap.mode} />
      </div>
      {snap.mode === 'public' && (
        <Alert variant="warn" data-testid="public-warning">
          <AlertDescription>
            This will be public: {shortAddress(to)} receives {snap.display} {PARAMS.TOKEN_SYMBOL}, readable by
            anyone, forever.
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
      <p className="text-xs text-ink-2">Mining pauses while the transfer is proved in your browser.</p>
    </div>
  );
}

/** Form → review (what will be public, the snapshot) → send. The send uses the snapshot only. */
export function WithdrawSheet({
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
      setStep({ kind: 'sent', block: await session.withdraw(snap) });
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
        <SheetTitle>Withdraw</SheetTitle>
        <SheetDescription>
          From this key's private balance of {fmt(balance, PARAMS.DECIMALS)} {PARAMS.TOKEN_SYMBOL}.
        </SheetDescription>
        {error && (
          <Alert variant="bad" data-testid="withdraw-error">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        {step.kind === 'form' && (
          <Form draft={draft} setDraft={setDraft} busy={busy} onReview={() => void toReview()} />
        )}
        {step.kind === 'review' && (
          <Review
            snap={step.snap}
            known={step.known}
            busy={busy}
            onSend={() => void send(step.snap)}
            onBack={() => setStep({ kind: 'form' })}
          />
        )}
        {step.kind === 'sent' && (
          <div className="flex flex-col gap-4" data-testid="withdraw-sent">
            <p className="text-ink">Sent, in block {step.block.toLocaleString('en-US')}.</p>
            <Button variant="primary" onClick={close}>
              Done
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
