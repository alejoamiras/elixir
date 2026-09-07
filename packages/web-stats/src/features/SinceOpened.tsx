import { useAtomValue } from 'jotai';
import { PARAMS } from '../../../miner-core/src/generated/params.ts';
import { amount, duration } from '../../../site/src/browser/format.ts';
import { Kpi } from '../../../ui/src/index.ts';
import { type Chain, sinceOpenedAtom } from '../state';
import { Tweened } from './Tweened';

/** What the chain minted since this tab's first read: the claims, the amount, the minutes. */
export function SinceOpened({ chain, now }: { chain: Chain; now: number }) {
  const since = useAtomValue(sinceOpenedAtom);
  const minted = since ? chain.supply - since.supply : 0n;
  const claims = Number(minted / PARAMS.REWARD);
  return (
    <Kpi
      label="since you opened"
      value={
        <span data-testid="since-opened">
          +<Tweened id="since-opened" value={claims} />
        </span>
      }
      unit={claims === 1 ? 'claim' : 'claims'}
      sub={
        since
          ? `${amount(minted, PARAMS.DECIMALS, 0)} ${PARAMS.TOKEN_SYMBOL} minted · ${duration(Math.max(0, (now - since.at) / 1000))}`
          : 'counting from the first read'
      }
    />
  );
}
