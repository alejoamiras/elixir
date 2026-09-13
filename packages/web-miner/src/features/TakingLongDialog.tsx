// Opens for a held or ready crossing older than the stated age — not on any bot's silence: there is
// no bot. It names what can be done: forward it yourself, redeem to Ethereum, change the RPC, wait.
import { useAtomValue } from 'jotai';
import { useState } from 'react';
import { Button, Dialog, DialogContent, DialogDescription, DialogTitle } from '../../../ui/src/index.ts';
import { TAKING_LONG_AFTER_MS, takingLong } from '../bridge/copy';
import { duration } from '../lib/format';
import { journalAtom, nowAtom } from '../state';

export function TakingLongDialog({ onSettings }: { onSettings: () => void }) {
  const journal = useAtomValue(journalAtom);
  const now = useAtomValue(nowAtom);
  const [dismissed, setDismissed] = useState<string>();
  const slow = journal.filter((c) => takingLong(c, now));
  const first = slow.find((c) => c.id !== dismissed);
  if (!first) return null;
  return (
    <Dialog open onOpenChange={(o) => !o && setDismissed(first.id)}>
      <DialogContent data-testid="taking-long">
        <DialogTitle>This is taking longer than usual.</DialogTitle>
        <DialogDescription>
          A crossing has waited {duration(Math.round((now - first.updatedAt) / 1000))} in the same state, past
          the
          {` ${duration(TAKING_LONG_AFTER_MS / 1000)}`} after which it is worth a look. Yacana forwards exits
          by hand; nothing is lost while a proven exit waits.
        </DialogDescription>
        <ul className="list-disc pl-5 text-sm text-ink-2">
          {first.state === 'ready' && (
            <li>Forward it yourself from the bridge tile: anyone may, any time.</li>
          )}
          {first.state === 'held' && (
            <li>Redeem it to Ethereum from the bridge tile: this account alone decides.</li>
          )}
          <li>
            Or check the Ethereum RPC in Settings: a silent RPC makes every crossing look stuck.{' '}
            <Button variant="link" size="sm" onClick={onSettings}>
              Settings
            </Button>
          </li>
        </ul>
        <Button variant="primary" onClick={() => setDismissed(first.id)}>
          Understood
        </Button>
      </DialogContent>
    </Dialog>
  );
}
