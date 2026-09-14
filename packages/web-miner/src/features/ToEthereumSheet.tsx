// To Ethereum: amount and address → the review (what will be public: the amount and the address;
// about 20 s to prove; Ethereum learns of it when this version proves the epoch) → sent. The
// journal card shows the rest.
import { useState } from 'react';
import { PARAMS } from '../../../miner-core/src/generated/params.ts';
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Button,
  Input,
  KvRow,
  Label,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from '../../../ui/src/index.ts';
import { type EthDraft, type EthSnapshot, reviewExit } from '../bridge/forms';
import { amount as fmt, shortAddress } from '../lib/format';
import type { Session } from '../session';

type Step = { kind: 'form' } | { kind: 'review'; snap: EthSnapshot } | { kind: 'sent'; snap: EthSnapshot };

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
      await session.bridge?.exitToL1(snap.amount, snap.to);
      setStep({ kind: 'sent', snap });
    } catch (e) {
      setError(e instanceof Error ? (e.message.split('\n')[0] ?? '') : String(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Sheet open={open} onOpenChange={(o) => (o ? onOpenChange(true) : close())}>
      <SheetContent data-testid="to-ethereum-sheet">
        <SheetTitle>To Ethereum</SheetTitle>
        <SheetDescription>
          From this account's private balance of {fmt(balance, PARAMS.DECIMALS)} {PARAMS.TOKEN_SYMBOL}, as
          YACA on Ethereum.
        </SheetDescription>
        {error && (
          <Alert variant="bad" data-testid="to-ethereum-error">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        {step.kind === 'form' && (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <Label htmlFor="exit-amount">Amount</Label>
              <Input
                id="exit-amount"
                value={draft.amount}
                onChange={(e) => setDraft({ ...draft, amount: e.target.value })}
                inputMode="decimal"
                placeholder="0.00"
                className="font-mono"
                data-testid="exit-amount"
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="exit-to">Ethereum address</Label>
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
            <Button variant="primary" onClick={toReview} data-testid="exit-review">
              Review
            </Button>
          </div>
        )}
        {step.kind === 'review' && (
          <div className="flex flex-col gap-4">
            <p className="label-mono">to ethereum · step 2 of 2</p>
            <div>
              <KvRow label="amount" value={`${step.snap.display} ${PARAMS.TOKEN_SYMBOL} → YACA`} />
              <KvRow label="to" value={shortAddress(step.snap.to)} />
              <KvRow
                label="fee"
                value="paid by the sponsor here; the forward on Ethereum by Yacana or by you"
              />
            </div>
            <Alert variant="warn" data-testid="exit-public">
              <AlertTitle>This will be public on Ethereum.</AlertTitle>
              <AlertDescription>
                The amount and the address are readable by anyone, forever. Ethereum learns of it when V
                {import.meta.env.VITE_ROLLUP_VERSION} proves the epoch, usually within a few epochs; the exit
                is then forwarded by hand, or by you.
              </AlertDescription>
            </Alert>
            <div className="flex gap-3">
              <Button
                variant="uv"
                disabled={busy}
                onClick={() => void send(step.snap)}
                data-testid="exit-send"
              >
                {busy ? 'Proving and sending…' : 'Send to Ethereum'}
              </Button>
              <Button variant="ghost" disabled={busy} onClick={() => setStep({ kind: 'form' })}>
                Back
              </Button>
            </div>
            <p className="text-xs text-ink-3">
              Mining pauses while the exit is proved in your browser, about 20 s.
            </p>
          </div>
        )}
        {step.kind === 'sent' && (
          <div className="flex flex-col gap-4" data-testid="exit-sent">
            <p className="text-lg font-semibold">Sent.</p>
            <p className="text-sm text-ink-2">
              {step.snap.display} {PARAMS.TOKEN_SYMBOL} left this account. The bridge tile follows it to
              Ethereum.
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
