// Every win this device recorded, newest first: the one place an old win's block stays findable once
// the session's ledger is gone.
import { PARAMS } from '@yacana/miner-core/generated/params';
import { ExternalLink } from '@yacana/ui';
import { links } from '../../explorer';
import { amount } from '../../lib/format';
import type { ClaimRecord } from '../../state';
import { Foot, TxDialog } from './Frame';

export function WinsList({ wins, className }: { wins: readonly ClaimRecord[]; className?: string }) {
  if (!wins.length) return <p className="text-xs text-ink-2">nothing yet</p>;
  return (
    <ol className={className ?? 'm-0 list-none p-0 font-mono text-xs'} data-testid="claims-history">
      {[...wins].reverse().map((c) => (
        <li key={`${c.epoch}-${c.block}`} className="flex gap-4 border-t border-line py-1 first:border-t-0">
          <span className="text-ink-2">{new Date(c.at).toISOString().slice(0, 16).replace('T', ' ')}</span>
          <span>epoch {c.epoch.toString()}</span>
          <span className="text-ink-2">
            block{' '}
            <ExternalLink href={links.block(c.block)} full={String(c.block)}>
              {c.block.toLocaleString('en-US')}
            </ExternalLink>
          </span>
        </li>
      ))}
    </ol>
  );
}

export function WinsDialog({
  wins,
  open,
  onOpenChange,
}: {
  wins: readonly ClaimRecord[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <TxDialog
      open={open}
      onOpenChange={onOpenChange}
      eyebrow="mine · this device"
      title={`${wins.length} ${wins.length === 1 ? 'win' : 'wins'}`}
      body={`Newest first. Each one minted ${amount(PARAMS.REWARD, PARAMS.DECIMALS)} ${PARAMS.TOKEN_SYMBOL} to this account, privately.`}
      data-testid="wins-dialog"
    >
      <WinsList wins={wins} className="m-0 max-h-[320px] list-none overflow-y-auto p-0 font-mono text-xs" />
      <Foot>
        The ledger on Mine holds this session's proofs; this list is every win this device recorded for the
        account, kept in the browser.
      </Foot>
    </TxDialog>
  );
}
