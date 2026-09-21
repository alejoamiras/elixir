import { Avatar, Icon } from '@yacana/ui';
import type { MasterRecord } from '../../keys/store';
import { shortAddress } from '../../lib/format';
import type { AccountError } from '../../state';
import { AccountNote, noteFor } from './Notes';
import { Primary, Quiet, QuietRow, Screen } from './Screen';

/** The device's account: one touch to open it (none when its secret is sealed here), or another account through Sign out. */
export function Welcome({
  record,
  error,
  busy,
  onOpen,
  onNotNow,
  onOther,
}: {
  record: MasterRecord;
  error?: AccountError;
  busy: boolean;
  onOpen: () => void;
  onNotNow: () => void;
  onOther: () => void;
}) {
  const passkey = record.method === 'passkey';
  const touch = passkey && !record.sealed;
  const primary = (error && noteFor(error, 'open').primary) ?? (touch ? 'Open with passkey' : 'Open');
  return (
    <Screen eyebrow="account" title="Welcome back.">
      <div className="flex items-center justify-between gap-3 rounded-[8px] border border-line-2 px-3.5 py-3">
        <span className="inline-flex items-center gap-[7px] font-mono text-[11.5px] text-ink-2">
          <Avatar />
          <span title={record.account.address} data-testid="key-address">
            {shortAddress(record.account.address)}
          </span>
        </span>
        <span className="font-mono text-[11px] text-ink-3">{passkey ? 'passkey' : '12 words'}</span>
      </div>
      {error && <AccountNote error={error} context="open" />}
      <Primary disabled={busy} onClick={onOpen} data-testid="open-key">
        {touch && <Icon name="finger" size={15} />}
        {primary}
      </Primary>
      <QuietRow>
        <Quiet disabled={busy} onClick={onNotNow} data-testid="not-now">
          Just watch for now
        </Quiet>
        <Quiet disabled={busy} onClick={onOther} data-testid="use-other">
          Use a different account
        </Quiet>
      </QuietRow>
    </Screen>
  );
}
