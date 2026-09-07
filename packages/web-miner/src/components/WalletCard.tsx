import { useAtomValue } from 'jotai';
import { PARAMS } from '../../../miner-core/src/generated/params.ts';
import { Badge, Button, Kpi, Tile, TileHeader } from '../../../ui/src/index.ts';
import { amount, shortAddress } from '../lib/format';
import { navigate } from '../routes';
import { balanceAtom, bootAtom, claimsAtom } from '../state';

export function WalletCard({ className }: { className?: string }) {
  const boot = useAtomValue(bootAtom);
  const balance = useAtomValue(balanceAtom);
  const claims = useAtomValue(claimsAtom);
  const ready = boot.phase === 'ready';
  return (
    <Tile className={className}>
      <TileHeader aside="private balance">your key</TileHeader>
      <div className="flex flex-col gap-3">
        <Kpi
          size="lg"
          label={<span className="sr-only">private balance</span>}
          value={
            <span data-testid="balance">{balance === null ? '…' : amount(balance, PARAMS.DECIMALS)}</span>
          }
          unit={PARAMS.TOKEN_SYMBOL}
        />
        <div className="flex gap-2">
          <Button variant="primary" size="sm" disabled={!ready} onClick={() => navigate('wallet')}>
            Withdraw
          </Button>
          <Button size="sm" disabled={!ready} onClick={() => navigate('wallet')}>
            Receive
          </Button>
        </div>
        {ready && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-2">
            <code title={boot.account} data-testid="account">
              {shortAddress(boot.account)}
            </code>
            <Badge variant={boot.record.method === 'passkey' ? 'uv' : 'neutral'}>
              {boot.record.method === 'passkey' ? 'passkey' : 'twelve words'}
            </Badge>
            <span>
              <span data-testid="claims">{claims.length}</span> claims this session
            </span>
          </div>
        )}
      </div>
    </Tile>
  );
}
