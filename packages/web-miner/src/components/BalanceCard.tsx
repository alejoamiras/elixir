import { useAtomValue, useSetAtom } from 'jotai';
import { PARAMS } from '../../../miner-core/src/generated/params.ts';
import {
  Button,
  ExternalLink,
  Kpi,
  Skeleton,
  Tile,
  TileHeader,
  useTweenedNumber,
} from '../../../ui/src/index.ts';
import { links } from '../explorer';
import { amount, shortAddress } from '../lib/format';
import { navigate } from '../routes';
import { balanceAtom, bootAtom, claimsAtom, signInAtom } from '../state';

export function BalanceCard({ className }: { className?: string }) {
  const boot = useAtomValue(bootAtom);
  const balance = useAtomValue(balanceAtom);
  const claims = useAtomValue(claimsAtom);
  const ready = boot.phase === 'ready';
  const opening = boot.phase === 'opening';
  const openSignIn = useSetAtom(signInAtom);
  // The tween is display only; anything that sends reads the store's bigint.
  const shown = useTweenedNumber(balance === null ? 0 : Number(amount(balance, PARAMS.DECIMALS, 2)));
  return (
    <Tile className={className}>
      <TileHeader aside="private">balance</TileHeader>
      <div className="flex flex-col gap-3">
        {opening ? (
          // The account is coming up: the shape of the balance and its line, not a number.
          <div className="flex flex-col gap-2" data-testid="balance-skeleton">
            <Skeleton className="h-10 w-24" />
            <Skeleton className="h-2.5 w-[180px]" />
          </div>
        ) : (
          <Kpi
            size="lg"
            label={<span className="sr-only">private balance</span>}
            value={
              <span
                data-testid="balance"
                data-exact={balance === null ? undefined : amount(balance, PARAMS.DECIMALS)}
              >
                {!ready ? '—' : balance === null ? '…' : shown.toFixed(2).replace(/\.?0+$/, '')}
              </span>
            }
            unit={PARAMS.TOKEN_SYMBOL}
          />
        )}
        <div className={opening ? 'flex gap-2 opacity-50' : 'flex gap-2'}>
          {ready ? (
            <Button variant="primary" size="sm" onClick={() => navigate('wallet', 'send')} data-testid="send">
              Send
            </Button>
          ) : (
            <Button
              variant="uv"
              size="sm"
              disabled={opening}
              onClick={() => openSignIn(true)}
              data-testid="sign-in-balance"
            >
              Sign in
            </Button>
          )}
          <Button variant="ghost" size="sm" disabled={!ready} onClick={() => navigate('wallet')}>
            Wallet →
          </Button>
        </div>
        {!ready && (
          <p className="text-xs text-ink-2">Your balance and your claims appear once an account is open.</p>
        )}
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
              <span data-testid="claims">{claims.length}</span> {claims.length === 1 ? 'claim' : 'claims'}{' '}
              this session
            </span>
          </div>
        )}
      </div>
    </Tile>
  );
}
