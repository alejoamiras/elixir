// Opens for a held or ready crossing older than the stated age — not on any bot's silence: there is
// no bot. As drawn: what is safe, then the two ways to do the forwarding yourself (with a wallet from
// the bridge tile; from anywhere with the call to paste, for an exit), and that waiting is fine too.
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
import { duration, amount as fmt, shortAddress } from '../lib/format';
import { journalAtom, nowAtom } from '../state';
import { forwardCall } from './forward-call';

function Column({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3 rounded-[8px] border border-line px-4 py-3.5">
      <b className="text-sm font-semibold">{title}</b>
      {children}
    </div>
  );
}

function FromAnywhere({ call }: { call: ReturnType<typeof forwardCall> }) {
  const [copied, setCopied] = useState(false);
  if (!call) return null;
  const text = `to ${call.to}\ndata ${call.data}`;
  return (
    <>
      <span className="text-xs text-ink-2">Paste this into any wallet or Etherscan’s write tab.</span>
      <pre
        className="m-0 max-h-28 overflow-auto whitespace-pre-wrap break-all rounded-[6px] border border-line bg-panel px-3 py-2.5 font-mono text-[11.5px] leading-[1.5] text-ink-2"
        data-testid="forward-call"
      >
        to {shortAddress(call.to)} (the portal){'\n'}forward · {call.data.slice(0, 18)}… (
        {(call.data.length - 2) / 2} bytes)
      </pre>
      <Button
        size="sm"
        variant="link"
        className="text-uv-2"
        onClick={async () => {
          await navigator.clipboard.writeText(text).catch(() => {});
          setCopied(true);
        }}
      >
        {copied ? 'copied' : 'copy the call'}
      </Button>
    </>
  );
}

export function TakingLongDialog({ onSettings, onWallet }: { onSettings: () => void; onWallet: () => void }) {
  const journal = useAtomValue(journalAtom);
  const now = useAtomValue(nowAtom);
  const [dismissed, setDismissed] = useState<string>();
  const slow = journal.filter((c) => takingLong(c, now));
  const first = slow.find((c) => c.id !== dismissed);
  if (!first) return null;
  const held = first.state === 'held';
  const waited = duration(Math.round((now - first.updatedAt) / 1000));
  const call = forwardCall(first);
  // The dialog would stay over the destination: it closes for this crossing before the page moves.
  const leave = (go: () => void) => {
    setDismissed(first.id);
    go();
  };
  return (
    <Dialog open onOpenChange={(o) => !o && setDismissed(first.id)}>
      <DialogContent data-testid="taking-long" className="max-w-[540px]">
        <span className="label-mono">taking long</span>
        <DialogTitle className="text-[22px] leading-[1.2] tracking-[-0.02em]">
          Nothing has moved for {waited}. Anyone can do the forwarding.
        </DialogTitle>
        <DialogDescription>
          Your {fmt(BigInt(first.amount), PARAMS.DECIMALS)} {PARAMS.TOKEN_SYMBOL}{' '}
          {held ? 'are held on Ethereum, proven and waiting' : 'are proven and waiting on Ethereum'}. Yacana
          forwards by hand, past the {duration(TAKING_LONG_AFTER_MS / 1000)} after which it is worth a look;
          nothing is lost while it waits.
          {held ? ' Redeem it to Ethereum from the bridge tile, any time: this account alone decides.' : ''}
        </DialogDescription>
        <div className="grid gap-3 md:grid-cols-2">
          <Column title="With an Ethereum wallet">
            <span className="text-xs text-ink-2">
              {held
                ? 'Forward it from the live version’s page, or redeem it: one transaction, the wallet pays the gas.'
                : 'Connect one on the bridge tile and send it. The wallet pays the gas.'}
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
          </Column>
          <Column title="From anywhere">
            {call ? (
              <FromAnywhere call={call} />
            ) : (
              <span className="text-xs text-ink-2">
                {held
                  ? 'Only you, from a device with this passkey, or Yacana’s listed forwarder may forward a send-ahead: a stranger could push it into a rollup about to stop.'
                  : 'The call appears here once the exit’s witness is saved in this wallet.'}
              </span>
            )}
          </Column>
        </div>
        <Note title="A silent Ethereum RPC makes every crossing look stuck.">
          <Button variant="link" size="sm" onClick={() => leave(onSettings)}>
            Check the RPC in Settings
          </Button>
        </Note>
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs text-ink-3">Waiting is fine too.</span>
          <Button variant="ghost" size="sm" onClick={() => setDismissed(first.id)}>
            Wait
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
