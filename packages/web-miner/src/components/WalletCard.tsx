import { useAtomValue } from 'jotai';
import { PARAMS } from '../../../miner-core/src/generated/params.ts';
import { Badge, Tile, TileHeader } from '../../../ui/src/index.ts';
import { amount, shortAddress } from '../lib/format';
import { balanceAtom, bootAtom, claimsAtom } from '../state';

export function WalletCard() {
  const boot = useAtomValue(bootAtom);
  const balance = useAtomValue(balanceAtom);
  const claims = useAtomValue(claimsAtom);
  return (
    <Tile>
      <TileHeader aside={boot.phase === 'ready' && boot.created && <Badge variant="uv">new account</Badge>}>
        Wallet
      </TileHeader>
      <div className="grid gap-2 text-sm">
        {boot.phase === 'booting' && (
          <p className="text-ink-2" data-testid="boot-step">
            {boot.step}…
          </p>
        )}
        {boot.phase === 'ready' && (
          <>
            <div className="flex justify-between">
              <span className="text-ink-2">Account</span>
              <code title={boot.account} data-testid="account">
                {shortAddress(boot.account)}
              </code>
            </div>
            <div className="flex justify-between">
              <span className="text-ink-2">Private balance</span>
              <span data-testid="balance">
                {balance === null ? '…' : `${amount(balance, PARAMS.DECIMALS)} ${PARAMS.TOKEN_SYMBOL}`}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-ink-2">Claims this session</span>
              <span data-testid="claims">{claims.length}</span>
            </div>
          </>
        )}
      </div>
    </Tile>
  );
}
