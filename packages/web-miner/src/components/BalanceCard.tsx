import { useAtomValue } from 'jotai';
import { PARAMS } from '../../../miner-core/src/generated/params.ts';
import { Button, ExternalLink, Kpi, Tile, TileHeader, useTweenedNumber } from '../../../ui/src/index.ts';
import { links } from '../explorer';
import { amount, shortAddress } from '../lib/format';
import { navigate } from '../routes';
import { balanceAtom, bootAtom, claimsAtom } from '../state';

/** The cockpit's balance: the amount, Send, the linked account, this session's claims. */
export function BalanceCard({ className }: { className?: string }) {
  const boot = useAtomValue(bootAtom);
  const balance = useAtomValue(balanceAtom);
  const claims = useAtomValue(claimsAtom);
  const ready = boot.phase === 'ready';
  // The tween is display only; anything that sends reads the store's bigint.
  const shown = useTweenedNumber(balance === null ? 0 : Number(amount(balance, PARAMS.DECIMALS, 2)));
  return (
    <Tile className={className}>
      <TileHeader aside="private">balance</TileHeader>
      <div className="flex flex-col gap-3">
        <Kpi
          size="lg"
          label={<span className="sr-only">private balance</span>}
          value={
            <span
              data-testid="balance"
              data-exact={balance === null ? undefined : amount(balance, PARAMS.DECIMALS)}
            >
              {balance === null ? '…' : shown.toFixed(2).replace(/\.?0+$/, '')}
            </span>
          }
          unit={PARAMS.TOKEN_SYMBOL}
        />
        <div className="flex gap-2">
          <Button
            variant="primary"
            size="sm"
            disabled={!ready}
            onClick={() => navigate('wallet', 'send')}
            data-testid="send"
          >
            Send
          </Button>
          <Button variant="ghost" size="sm" disabled={!ready} onClick={() => navigate('wallet')}>
            Wallet →
          </Button>
        </div>
        {ready && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-2">
            <span className="chip inline-flex items-center gap-1.5 rounded-sm border border-line bg-panel px-2 py-1 font-mono text-2xs">
              <span>account</span>
              <ExternalLink
                href={links.address(boot.account)}
                full={boot.account}
                className="text-ink"
                data-testid="account"
              >
                {shortAddress(boot.account)}
              </ExternalLink>
            </span>
            <span>
              <span data-testid="claims">{claims.length}</span> claims this session
            </span>
          </div>
        )}
      </div>
    </Tile>
  );
}
