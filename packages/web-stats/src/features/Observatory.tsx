// The six numbers, each with the one line under it that says where it comes from.
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
import { Button, Kpi, Tile } from '../../../ui/src/index.ts';
import type { Chain } from '../state';
import { Calculator } from './Calculator';

const RULES = { N: PARAMS.N, EXPECTED_EPOCH_SECONDS: PARAMS.EXPECTED_EPOCH_SECONDS, T_MAX: PARAMS.T_MAX };

/** The open epoch's lines, or the honest placeholders when the history could not be read. */
function epochLines(chain: Chain, nowSec: number) {
  const rows = chain.rows;
  const open = rows[rows.length - 1];
  if (!open)
    return {
      claimsSub: 'history unavailable',
      difficulty: '—',
      difficultySub: 'no close yet',
      last: '—',
      lastSub: 'history unavailable',
    };
  const lastClosed = rows.length >= 2 ? rows[rows.length - 2] : undefined;
  const elapsed = BigInt(Math.max(0, nowSec - open.openedAt));
  const hatch = Number(escapeHatchIn(BigInt(open.openedAt), PARAMS.T_MAX, BigInt(nowSec)));
  const claimsSeen = rows.reduce((n, r) => n + r.claims, 0);
  return {
    claimsSub: `open ${duration(Number(elapsed))} · expected ${duration(Number(PARAMS.EXPECTED_EPOCH_SECONDS))}`,
    difficulty: difficulty(open.target).toFixed(1),
    difficultySub: lastClosed?.retarget
      ? `×${(1 / lastClosed.retarget).toFixed(2)} at the last close · if it closed now ×${closePreview(open.target, elapsed, RULES).toFixed(2)}`
      : 'no close yet',
    last: `${open.claims} in this epoch`,
    lastSub:
      hatch > 0
        ? `escape hatch in ${duration(hatch)} · ${compact(claimsSeen)} claims in the ${rows.length} epochs shown`
        : 'anyone may close this epoch now',
  };
}

export function Observatory({ chain, now }: { chain: Chain; now: number }) {
  const [calc, setCalc] = useState(false);
  const rows = chain.rows;
  const open = rows[rows.length - 1];
  const nowSec = Math.max(chain.block.timestamp, Math.floor(now / 1000));
  const rate = networkRate(rows, PARAMS.N);
  const perHour = claimsPerHour(rows, nowSec);
  const unit = Number(PARAMS.REWARD / 10n ** BigInt(PARAMS.DECIMALS));
  const lines = epochLines(chain, nowSec);
  return (
    <div className="grid gap-4 md:grid-cols-3" data-testid="observatory">
      <Tile>
        <Kpi
          label="minted"
          value={<span data-testid="minted">{amount(chain.supply, PARAMS.DECIMALS, 0)}</span>}
          unit={PARAMS.TOKEN_SYMBOL}
          size="lg"
          sub={`${amount(chain.supply / PARAMS.REWARD, 0)} claims × ${unit} · 0 premine`}
        />
      </Tile>
      <Tile>
        <Kpi
          label={`epoch ${chain.open}`}
          value={
            <span data-testid="open-claims">
              {open?.claims ?? 0} of {PARAMS.N}
            </span>
          }
          unit="claims"
          size="lg"
          sub={lines.claimsSub}
        />
      </Tile>
      <Tile>
        <Kpi
          label="difficulty"
          value={<span data-testid="difficulty">{lines.difficulty}</span>}
          size="lg"
          sub={lines.difficultySub}
        />
      </Tile>
      <Tile>
        <Kpi
          label="claims / hour"
          value={<span data-testid="claims-per-hour">{perHour.toFixed(0)}</span>}
          unit={`of ${scheduledClaimsPerHour(RULES)}`}
          size="lg"
          sub={`schedule: ${PARAMS.N} per ${PARAMS.EXPECTED_EPOCH_SECONDS} s`}
        />
      </Tile>
      <Tile>
        <Kpi
          label="network"
          value={<span data-testid="network-rate">{rate === null ? '—' : `≈ ${rate.toFixed(2)}`}</span>}
          unit="proofs/s"
          size="lg"
          sub={rate === null ? 'no closed epoch yet' : 'median of the last 6 closed epochs · noisy by design'}
        />
        <Button
          size="sm"
          variant="link"
          className="mt-2 px-0"
          onClick={() => setCalc(true)}
          data-testid="calculator"
        >
          what would my rate earn?
        </Button>
        <Calculator open={calc} onOpenChange={setCalc} network={rate ?? 0} target={open?.target ?? 1n} />
      </Tile>
      <Tile>
        <Kpi
          label="last claim"
          value={<span data-testid="last-claim">{lines.last}</span>}
          size="lg"
          sub={lines.lastSub}
        />
      </Tile>
    </div>
  );
}
