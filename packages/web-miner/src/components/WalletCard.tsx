import { useAtomValue } from 'jotai';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PARAMS } from '../../../miner-core/src/generated/params.ts';
import { amount, shortAddress } from '../lib/format';
import { balanceAtom, bootAtom, claimsAtom } from '../state';

export function WalletCard() {
  const boot = useAtomValue(bootAtom);
  const balance = useAtomValue(balanceAtom);
  const claims = useAtomValue(claimsAtom);
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Wallet</CardTitle>
        {boot.phase === 'ready' && boot.created && <Badge variant="secondary">new account</Badge>}
      </CardHeader>
      <CardContent className="grid gap-2 text-sm">
        {boot.phase === 'booting' && (
          <p className="text-muted-foreground" data-testid="boot-step">
            {boot.step}…
          </p>
        )}
        {boot.phase === 'ready' && (
          <>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Account</span>
              <code title={boot.account} data-testid="account">
                {shortAddress(boot.account)}
              </code>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Private balance</span>
              <span data-testid="balance">
                {balance === null ? '…' : `${amount(balance, PARAMS.DECIMALS)} ${PARAMS.TOKEN_SYMBOL}`}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Claims this session</span>
              <span data-testid="claims">{claims.length}</span>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
