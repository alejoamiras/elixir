import { useState } from 'react';
import { PARAMS } from '../../../miner-core/src/generated/params.ts';
import {
  claimsPerHour,
  closePreview,
  difficulty,
  escapeHatchIn,
  networkRate,
  scheduledClaimsPerHour,
} from '../../../miner-core/src/metrics.ts';
import { amount, compact, duration } from '../../../site/src/browser/format.ts';
import { Button, difficultyLabel, Kpi, Tile } from '../../../ui/src/index.ts';
import type { Chain } from '../state';
import { Calculator } from './Calculator';

const RULES = { N: PARAMS.N, EXPECTED_EPOCH_SECONDS: PARAMS.EXPECTED_EPOCH_SECONDS, T_MAX: PARAMS.T_MAX };
const CELL = 'md:col-span-2 xl:col-span-1';

/** The row of the open epoch; absent while a history read fails after a close. */
const openRow = (chain: Chain) => chain.rows.find((r) => r.epoch === chain.open);

/** The open epoch's lines, or the honest placeholders when its row could not be read. */
function epochLines(chain: Chain, nowSec: number) {
  const rows = chain.rows;
  const open = openRow(chain);
  if (!open)
    return {
      claimsSub: rows.length ? 'this epoch not read yet' : 'history unavailable',
      difficulty: '—',
      difficultySub: 'no close yet',
      lastSub: 'history unavailable',
    };
  const lastClosed = rows.find((r) => r.epoch === chain.open - 1);
  const elapsed = BigInt(Math.max(0, nowSec - open.openedAt));
  const hatch = Number(escapeHatchIn(BigInt(open.openedAt), PARAMS.T_MAX, BigInt(nowSec)));
  const claimsSeen = rows.reduce((n, r) => n + r.claims, 0);
  return {
    claimsSub: `open ${duration(Number(elapsed))} · expected ${duration(Number(PARAMS.EXPECTED_EPOCH_SECONDS))}`,
    difficulty: difficultyLabel(difficulty(open.target)),
    difficultySub: lastClosed?.retarget
      ? `×${(1 / lastClosed.retarget).toFixed(2)} at the last close · if it closed now ×${closePreview(open.target, elapsed, RULES).toFixed(2)}`
      : 'no close yet',
    lastSub:
      hatch > 0
        ? `escape hatch in ${duration(hatch)} · ${compact(claimsSeen)} claims in the ${rows.length} epochs shown`
        : 'anyone may close this epoch now',
  };
}

/** Six KPI tiles, placed by the page's grid (`contents`), at the binder's `.num` size. */
export function Observatory({ chain, now }: { chain: Chain; now: number }) {
  const [calc, setCalc] = useState(false);
  const rows = chain.rows;
  const open = openRow(chain);
  const nowSec = Math.max(chain.block.timestamp, Math.floor(now / 1000));
  const rate = networkRate(rows, PARAMS.N);
  const perHour = claimsPerHour(rows, nowSec);
  const unit = Number(PARAMS.REWARD / 10n ** BigInt(PARAMS.DECIMALS));
  const lines = epochLines(chain, nowSec);
  return (
    <div className="contents" data-testid="observatory">
      <Tile className={CELL}>
        <Kpi
          label="minted"
          value={<span data-testid="minted">{amount(chain.supply, PARAMS.DECIMALS, 0)}</span>}
          unit={PARAMS.TOKEN_SYMBOL}
          sub={`${amount(chain.supply / PARAMS.REWARD, 0)} claims × ${unit} · 0 premine`}
        />
      </Tile>
      <Tile className={CELL}>
        <Kpi
          label={`epoch ${chain.open}`}
          value={<span data-testid="open-claims">{open ? open.claims : '—'}</span>}
          unit={`of ${PARAMS.N} claims`}
          sub={lines.claimsSub}
        />
      </Tile>
      <Tile className={CELL}>
        <Kpi
          label="difficulty"
          value={<span data-testid="difficulty">{lines.difficulty}</span>}
          sub={lines.difficultySub}
        />
      </Tile>
      <Tile className={CELL}>
        <Kpi
          label="claims / hour"
          value={<span data-testid="claims-per-hour">{perHour.toFixed(0)}</span>}
          unit={`of ${scheduledClaimsPerHour(RULES)}`}
          sub={`schedule: ${PARAMS.N} per ${PARAMS.EXPECTED_EPOCH_SECONDS} s · an estimate: storage keeps counts per epoch, not claim times`}
        />
      </Tile>
      <Tile className={CELL}>
        <Kpi
          label="network"
          value={<span data-testid="network-rate">{rate === null ? '—' : `≈ ${rate.toFixed(2)}`}</span>}
          unit="proofs/s"
          sub={rate === null ? 'no closed epoch yet' : 'median of the last 6 closed epochs · noisy by design'}
        />
        <Button
          size="sm"
          variant="link"
          className="mt-2 px-0"
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
        <Kpi
          label="last claim"
          value={<span data-testid="last-claim">{open ? open.claims : '—'}</span>}
          unit="in this epoch"
          sub={lines.lastSub}
        />
      </Tile>
    </div>
  );
}
