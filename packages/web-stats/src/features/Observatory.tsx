import { useState } from 'react';
import { PARAMS } from '../../../miner-core/src/generated/params.ts';
import {
  claimsPerHour,
  difficulty,
  escapeHatchIn,
  networkRate,
  scheduledClaimsPerHour,
} from '../../../miner-core/src/metrics.ts';
import { amount, clockMinutes } from '../../../site/src/browser/format.ts';
import { Button, difficultyLabel, Kpi, Tile } from '../../../ui/src/index.ts';
import type { Chain } from '../state';
import { Calculator } from './Calculator';
import { EpochRing } from './EpochRing';
import { SinceOpened } from './SinceOpened';
import { Tweened } from './Tweened';

const RULES = { N: PARAMS.N, EXPECTED_EPOCH_SECONDS: PARAMS.EXPECTED_EPOCH_SECONDS, T_MAX: PARAMS.T_MAX };
const CELL = 'md:col-span-2 xl:col-span-1';
const EXPECTED = Number(PARAMS.EXPECTED_EPOCH_SECONDS);

/** The row of the open epoch; absent while a history read fails after a close. */
const openRow = (chain: Chain) => chain.rows.find((r) => r.epoch === chain.open);

/** The open epoch's tile: the ring and the counter, or the honest placeholder when its row could not be read. */
function OpenEpoch({ chain, nowSec }: { chain: Chain; nowSec: number }) {
  const open = openRow(chain);
  if (!open)
    return (
      <Kpi
        label={`epoch ${chain.open}`}
        value={<span data-testid="open-claims">—</span>}
        unit={`of ${PARAMS.N} claims`}
        sub={chain.rows.length ? 'this epoch not read yet' : 'history unavailable'}
      />
    );
  const elapsed = Math.max(0, nowSec - open.openedAt);
  const hatch = Number(escapeHatchIn(BigInt(open.openedAt), PARAMS.T_MAX, BigInt(nowSec)));
  return (
    <Kpi
      label={`epoch ${chain.open}`}
      value={<span data-testid="open-claims">{open.claims}</span>}
      unit={`of ${PARAMS.N} claims`}
      sub={
        <span className="inline-flex items-center gap-1.5">
          <EpochRing elapsed={elapsed} expected={EXPECTED} hatch={hatch} />
          <span data-testid="open-for">
            open {clockMinutes(elapsed)} · expected {clockMinutes(EXPECTED)}
          </span>
        </span>
      }
    />
  );
}

/** Six KPI tiles, placed by the page's grid (`contents`), each sub one line. */
export function Observatory({ chain, now }: { chain: Chain; now: number }) {
  const [calc, setCalc] = useState(false);
  const rows = chain.rows;
  const open = openRow(chain);
  const nowSec = Math.max(chain.block.timestamp, Math.floor(now / 1000));
  const rate = networkRate(rows, PARAMS.N);
  const perHour = claimsPerHour(rows, nowSec);
  const unit = Number(PARAMS.REWARD / 10n ** BigInt(PARAMS.DECIMALS));
  const lastClosed = rows.find((r) => r.epoch === chain.open - 1);
  return (
    <div className="contents" data-testid="observatory">
      <Tile className={CELL}>
        <Kpi
          label="minted"
          value={
            <span data-testid="minted">
              <Tweened id="minted" value={Number(amount(chain.supply, PARAMS.DECIMALS, 0))} />
            </span>
          }
          unit={PARAMS.TOKEN_SYMBOL}
          sub={`${amount(chain.supply / PARAMS.REWARD, 0)} claims × ${unit} · no premine`}
        />
      </Tile>
      <Tile className={CELL}>
        <OpenEpoch chain={chain} nowSec={nowSec} />
      </Tile>
      <Tile className={CELL}>
        <Kpi
          label="difficulty"
          value={
            <span data-testid="difficulty">{open ? difficultyLabel(difficulty(open.target)) : '—'}</span>
          }
          sub={
            lastClosed?.retarget
              ? `×${(1 / lastClosed.retarget).toFixed(2)} at the last close`
              : 'no close yet'
          }
        />
      </Tile>
      <Tile className={CELL}>
        <Kpi
          label="claims / hour"
          value={
            <span data-testid="claims-per-hour">
              <Tweened id="claims-per-hour" value={perHour} />
            </span>
          }
          unit={`of ${scheduledClaimsPerHour(RULES)}`}
          sub="an estimate from epoch counts"
        />
      </Tile>
      <Tile className={CELL}>
        <Kpi
          label="network"
          value={<span data-testid="network-rate">{rate === null ? '—' : `≈ ${rate.toFixed(2)}`}</span>}
          unit="proofs/s"
          sub={rate === null ? 'no closed epoch yet' : undefined}
        />
        <Button
          size="sm"
          variant="link"
          className="mt-1 h-auto px-0 text-xs"
          disabled={rate === null || !open}
          onClick={() => setCalc(true)}
          data-testid="calculator"
        >
          what would my rate earn?
        </Button>
        {rate !== null && open && (
          <Calculator open={calc} onOpenChange={setCalc} network={rate} target={open.target} />
        )}
      </Tile>
      <Tile className={CELL}>
        <SinceOpened chain={chain} now={now} />
      </Tile>
    </div>
  );
}
