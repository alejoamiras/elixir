// Signing out drops the account from this device. A passkey brings it back; twelve words bring it back only
// if they were written down, so an unbacked words account is sent to the backup first. The hold is the
// default gesture and a plain click is always one link away; both run the same eligibility check.
import { useState } from 'react';
import { PARAMS } from '../../../miner-core/src/generated/params.ts';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  HoldButton,
} from '../../../ui/src/index.ts';
import type { MasterRecord } from '../keys/store';
import { amount, shortAddress } from '../lib/format';

/** Whether this account may be dropped from the device without losing it. */
export const canSignOut = (record: Pick<MasterRecord, 'method' | 'backedUp'>): boolean =>
  record.method === 'passkey' || record.backedUp;

function Note({ record }: { record: Pick<MasterRecord, 'method' | 'backedUp'> }) {
  if (record.method === 'passkey')
    return (
      <div className="flex flex-col gap-1 rounded-[6px] border border-line bg-panel px-3.5 py-3">
        <p className="text-sm font-medium text-ink">Your passkey signs you back in.</p>
        <p className="text-sm text-ink-2">
          It is saved on this device and wherever your platform syncs passkeys, so there is nothing to write
          down.
        </p>
      </div>
    );
  return (
    <div className="flex flex-col gap-1 rounded-[6px] border border-line bg-panel px-3.5 py-3">
      <p className="text-sm font-medium text-ink">
        {record.backedUp ? 'Make sure your twelve words are saved.' : 'Back up the twelve words first.'}
      </p>
      <p className="text-sm text-ink-2">
        They are the only way back into this account; Yacana keeps no copy.
        {!record.backedUp && ' This account has not confirmed them yet.'}
      </p>
    </div>
  );
}

export function SignOutDialog({
  record,
  balance,
  open,
  onOpenChange,
  onSignOut,
  onBackUp,
}: {
  record: MasterRecord;
  balance: bigint | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSignOut: () => Promise<void>;
  onBackUp: () => void;
}) {
  const [plain, setPlain] = useState(false);
  const [busy, setBusy] = useState(false);
  const eligible = canSignOut(record);
  const signOut = () => {
    // Re-checked here so neither path can drop an account the other would refuse.
    if (!canSignOut(record) || busy) return;
    setBusy(true);
    void onSignOut().finally(() => setBusy(false));
  };
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) setPlain(false);
        onOpenChange(o);
      }}
    >
      <DialogContent data-testid="sign-out-dialog">
        <DialogTitle>Sign out of this account?</DialogTitle>
        <DialogDescription>
          <span className="font-mono" title={record.account.address}>
            {shortAddress(record.account.address)}
          </span>
          {balance !== null && (
            <>
              {' '}
              · {amount(balance, PARAMS.DECIMALS)} {PARAMS.TOKEN_SYMBOL} stays on the chain, with the account.
            </>
          )}
        </DialogDescription>
        <Note record={record} />
        <div className="flex flex-wrap items-center gap-3">
          {!eligible ? (
            <Button variant="primary" onClick={onBackUp} data-testid="back-up-first">
              Back up the twelve words
            </Button>
          ) : plain ? (
            <Button variant="danger" disabled={busy} onClick={signOut} data-testid="sign-out-click">
              {busy ? 'Signing out…' : 'Sign out'}
            </Button>
          ) : (
            <HoldButton onConfirm={signOut} disabled={busy} data-testid="sign-out-hold">
              {busy ? 'Signing out…' : 'Hold to sign out'}
            </HoldButton>
          )}
          <Button variant="ghost" disabled={busy} onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
        </div>
        {eligible && !plain && (
          <button
            type="button"
            className="self-start text-xs text-ink-2 underline underline-offset-3 hover:text-ink"
            onClick={() => setPlain(true)}
            data-testid="sign-out-plain"
          >
            Can't hold? Sign out with a click
          </button>
        )}
      </DialogContent>
    </Dialog>
  );
}
