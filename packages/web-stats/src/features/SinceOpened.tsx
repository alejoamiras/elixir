import { useAtomValue } from 'jotai';
import { PARAMS } from '../../../miner-core/src/generated/params.ts';
import { amount, duration } from '../../../site/src/browser/format.ts';
import { Kpi } from '../../../ui/src/index.ts';
import { sinceOpenedAtom } from '../state';
import { SK_SUB, Sk } from './Sk';
import { Tweened } from './Tweened';

/** Claims minted since this tab's first read; a skeleton until beat one lands. */
export function SinceOpened({ supply, now }: { supply: bigint | null; now: number }) {
  const since = useAtomValue(sinceOpenedAtom);
  if (supply === null)
    return (
      <Kpi
        label="since you opened"
        value={
          <span data-testid="since-opened">
            <Tweened id="since-opened" value={null} />
          </span>
        }
        sub={<Sk className={SK_SUB} />}
      />
    );
  const minted = since ? supply - since.supply : 0n;
  // A supply below the first read (a reorg, a stale answer, a lying node) is said, not shown as a negative count.
  if (minted < 0n)
    return (
      <Kpi
        label="since you opened"
        value={<span data-testid="since-opened">—</span>}
        sub="the supply read lower than at the first read"
      />
    );
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
