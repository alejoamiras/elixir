// Signing out drops the account from this device. A passkey brings it back; twelve words bring it
// back only if they were written down, so an unbacked words account is sent to the backup first.
// The gesture is a hold; the click path appears one failed hold away, for whoever can only click.
import { useAtomValue } from 'jotai';
import { useState } from 'react';
import { Button, Dialog, DialogContent, DialogTitle, HoldButton } from '../../../ui/src/index.ts';
import type { MasterRecord } from '../keys/store';
import { shortAddress } from '../lib/format';
import { minerAtom, nowAtom } from '../state';

/** Whether this account may be dropped from the device without losing it. */
export const canSignOut = (record: Pick<MasterRecord, 'method' | 'backedUp'>): boolean =>
  record.method === 'passkey' || record.backedUp;

const bodyFor = (record: Pick<MasterRecord, 'method' | 'backedUp'>, mining: boolean, claiming: boolean) => {
  if (!canSignOut(record))
    return 'Your 12 words are the only way back in, and they are not backed up yet. Yacana keeps no copy.';
  const back =
    record.method === 'passkey' ? 'Your passkey logs you back in.' : 'Your 12 words log you back in.';
  return `${back} Your balance stays with the account.${mining ? ' Mining stops.' : ''}${claiming ? ' A win is being claimed; sign out waits for it.' : ''}`;
};

/**
 * `record` is the open account's, or the device's from Welcome ("Use a different account"): then
 * nothing mines and `onBackUp` opens the account, since the words show only from the Wallet.
 */
export function SignOutDialog({
  record,
  open,
  onOpenChange,
  onSignOut,
  onBackUp,
}: {
  record: MasterRecord;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSignOut: () => Promise<void>;
  onBackUp: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const miner = useAtomValue(minerAtom);
  const now = useAtomValue(nowAtom);
  const claim = miner.phase === 'claiming' ? miner.claim : null;
  const mining = miner.phase === 'mining' || claim !== null;
  const eligible = canSignOut(record);
  const signOut = () => {
    // Re-checked here so neither path can drop an account the other would refuse.
    if (!canSignOut(record) || busy) return;
    setBusy(true);
    void onSignOut().finally(() => setBusy(false));
  };
  const claimSeconds = claim
    ? Math.max(0, Math.round((claim.done.reduce((a, b) => a + b, 0) + now - claim.since) / 1000))
    : 0;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="tx" aria-describedby={undefined} data-testid="sign-out-dialog">
        <div className="flex flex-col gap-2">
          <span className="font-mono text-[11.5px] font-medium uppercase leading-none tracking-[0.14em] text-uv-2">
            account ·{' '}
            <span className="normal-case" title={record.account.address}>
              {shortAddress(record.account.address)}
            </span>
          </span>
          <DialogTitle className="text-[22px] leading-[1.2] font-semibold tracking-[-0.02em] text-ink">
            Sign out?
          </DialogTitle>
          <p className="text-sm leading-[1.5] text-ink-2 [text-wrap:pretty]">
            {bodyFor(record, mining, claim !== null)}
          </p>
        </div>
        {eligible ? (
          <div className="flex flex-col gap-2.5">
            <HoldButton
              onConfirm={signOut}
              disabled={busy}
              className="h-[46px] w-full px-[22px] text-[15px]"
              waitingLabel={claim ? `Claim finishing · ${claimSeconds} s` : undefined}
              reveal={
                <>
                  hold for 1.2 s ·{' '}
                  <button
                    type="button"
                    className="text-uv-2 underline underline-offset-3 hover:text-ink"
                    disabled={busy}
                    onClick={signOut}
                    data-testid="sign-out-click"
                  >
                    Sign out with a click
                  </button>
                </>
              }
              data-testid="sign-out-hold"
            >
              {busy ? 'Signing out…' : 'Hold to sign out'}
            </HoldButton>
            <Button variant="ghost" disabled={busy} onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
          </div>
        ) : (
          <>
            <div className="flex gap-2.5">
              <Button variant="uv" onClick={onBackUp} data-testid="back-up-first">
                Back up my 12 words
              </Button>
              <Button variant="ghost" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
            </div>
            <p className="font-mono text-[11px] text-ink-3">sign out anyway · after the backup</p>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
