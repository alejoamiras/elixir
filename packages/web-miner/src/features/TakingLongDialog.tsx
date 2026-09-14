// Opens for a send-ahead held on Ethereum longer than the stated age — not on any bot's silence:
// there is no bot. What is safe, what the holder can do about it from the bridge tile, and that
// waiting is fine too.
import { useAtomValue } from 'jotai';
import { useState } from 'react';
import { PARAMS } from '../../../miner-core/src/generated/params.ts';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  Note,
} from '../../../ui/src/index.ts';
import { TAKING_LONG_AFTER_MS, takingLong } from '../bridge/copy';
import { duration, amount as fmt } from '../lib/format';
import { journalAtom, nowAtom } from '../state';

export function TakingLongDialog({ onSettings, onWallet }: { onSettings: () => void; onWallet: () => void }) {
  const journal = useAtomValue(journalAtom);
  const now = useAtomValue(nowAtom);
  const [dismissed, setDismissed] = useState<ReadonlySet<string>>(new Set());
  const slow = journal.filter((c) => takingLong(c, now));
  const first = slow.find((c) => !dismissed.has(c.id));
  const dismiss = (ids: string[]) => setDismissed((was) => new Set([...was, ...ids]));
  if (!first) return null;
  const waited = duration(Math.round((now - first.updatedAt) / 1000));
  // The dialog would stay over the destination: every slow crossing's is dismissed before the page moves.
  const leave = (go: () => void) => {
    dismiss(slow.map((c) => c.id));
    go();
  };
  return (
    <Dialog open onOpenChange={(o) => !o && dismiss([first.id])}>
      <DialogContent data-testid="taking-long" className="max-w-[540px]">
        <span className="label-mono">taking long</span>
        <DialogTitle className="text-[22px] leading-[1.2] tracking-[-0.02em]">
          Held for {waited}. Forward it yourself, or wait.
        </DialogTitle>
        <DialogDescription>
          Your {fmt(BigInt(first.amount), PARAMS.DECIMALS)} {PARAMS.TOKEN_SYMBOL} are held on Ethereum, proven
          and waiting for the next version. Yacana forwards by hand; past{' '}
          {duration(TAKING_LONG_AFTER_MS / 1000)} it is worth a look. Nothing is lost while it waits; you can
          redeem it on Ethereum any time before the last day, when the bridge is not paused: this account
          alone decides.
        </DialogDescription>
        <div className="flex flex-col gap-3 rounded-[8px] border border-line px-4 py-3.5">
          <b className="text-sm font-semibold">With an Ethereum wallet</b>
          <span className="text-xs text-ink-2">
            Forward it from the next version’s page, or redeem it from the bridge tile: one transaction, the
            wallet pays the gas. Only this passkey or an authorized relayer may forward it.
          </span>
          <div>
            <Button size="sm" variant="uv" onClick={() => leave(onWallet)}>
              Open the bridge tile
            </Button>
          </div>
          <span className="text-xs text-warn">
            That wallet is public as the sender. It pairs with this crossing’s amount, not with your Aztec
            account.
          </span>
        </div>
        <Note title="A silent Ethereum RPC makes every crossing look stuck.">
          <Button variant="link" size="sm" onClick={() => leave(onSettings)}>
            Check the RPC in Settings
          </Button>
        </Note>
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs text-ink-3">Waiting is fine too.</span>
          <Button variant="ghost" size="sm" onClick={() => dismiss([first.id])}>
            Wait
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
