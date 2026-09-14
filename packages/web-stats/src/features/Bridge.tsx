// The bridge page's tiles. The portal knows what left each version and what arrived, not who
// holds what: every figure here is a flow or this build's own supply.

import type { VersionFlows } from '../../../bridge/src/portal-reader.ts';
import type { MigrationRecord } from '../../../bridge/src/record.ts';
import { PARAMS } from '../../../miner-core/src/generated/params.ts';
import type { EpochRow } from '../../../miner-core/src/reader.ts';
import { firstEpoch } from '../../../site/src/browser/connection.ts';
import { amount, duration } from '../../../site/src/browser/format.ts';
import {
  Badge,
  ChipLink,
  ExternalLink,
  Kpi,
  KvRow,
  StackedBar,
  Tile,
  TileHeader,
  Timeline,
} from '../../../ui/src/index.ts';
import {
  type BridgeSnapshot,
  chainNow,
  coinsSeries,
  day,
  exitLimitLine,
  figuresOf,
  forwardingLine,
  kpisOf,
  type MinerFlows,
  pauseLine,
  phasesOf,
  versionLine,
  whereOf,
} from '../bridge-beat';
import { l1Links } from '../explorer';
import { FAQ_HREF } from '../routes';
import { CoinsChart } from './CoinsChart';

const FIRST = firstEpoch();

const yaca = (raw: bigint) => `${amount(raw, PARAMS.DECIMALS, 2)} ${PARAMS.TOKEN_SYMBOL}`;
const OPEN_ENDED = (1n << 256n) - 1n;

const chainName = (chainId: string): string =>
  chainId === '1'
    ? 'Ethereum'
    : chainId === '11155111'
      ? 'Sepolia'
      : chainId === '31337'
        ? 'anvil'
        : `chain ${chainId}`;

export function BridgeKpis({
  snapshot,
  live,
  miner,
  supply,
  now,
  chainId,
}: {
  snapshot: BridgeSnapshot;
  live: VersionFlows | undefined;
  miner: MinerFlows | undefined;
  supply: bigint | undefined;
  now: number;
  chainId: string;
}) {
  const kpis = kpisOf(snapshot, live, miner, supply, chainNow(snapshot, now), chainName(chainId));
  return (
    <div className="grid grid-cols-2 gap-3.5 md:grid-cols-3 xl:grid-cols-6" data-testid="bridge-kpis">
      {kpis.map((k) => (
        <Tile key={k.id} data-testid={`kpi-${k.id}`}>
          <Kpi label={k.label} value={k.value} unit={k.unit} sub={k.sub} />
        </Tile>
      ))}
    </div>
  );
}

export function BridgePhases({
  version,
  migration,
  nowSeconds,
  className,
}: {
  version: VersionFlows | undefined;
  migration: MigrationRecord | null;
  /** Ethereum's clock as observed at the read, never the device's: the closing day is a categorical call. */
  nowSeconds: number;
  className?: string;
}) {
  return (
    <Tile className={className} data-testid="bridge-phases">
      <TileHeader
        aside={
          <a href={FAQ_HREF} className="hover:text-ink" data-testid="bridge-faq">
            what happens →
          </a>
        }
      >
        {version ? `aztec v${version.version} · the phases` : 'the phases'}
      </TileHeader>
      {version ? (
        <Timeline items={phasesOf(version, migration, nowSeconds)} className="mt-1.5" />
      ) : (
        <p className="text-xs text-ink-3">reading the portal…</p>
      )}
      <p className="mt-3.5 text-pretty text-xs text-ink-3">
        A version is mined while canonical, can be left while it proves, and is closed to exits at the later
        of the version after next and 180 days after the flip, extended by every day the bridge was paused.
      </p>
    </Tile>
  );
}

export function BridgeCoins({
  rows,
  snapshot,
  now,
}: {
  rows: readonly EpochRow[];
  snapshot: BridgeSnapshot;
  now: number;
}) {
  // The emission is exact only over every epoch since this version's first, with no gap: a window
  // loaded beside the latest one would draw a false total.
  const last = rows.reduce((a, r) => Math.max(a, r.epoch), -1);
  const complete = rows.length > 0 && rows.length === last - FIRST + 1 && rows.every((r) => r.epoch >= FIRST);
  // A send ahead lands on the next version without a claim here: once two versions have minted, no
  // version's rows and flows add up to a balance, so the split is drawn only while one has.
  const versions = snapshot.versions.length;
  const points =
    complete && versions === 1 && snapshot.extras
      ? coinsSeries(rows, snapshot.extras.events, chainNow(snapshot, now))
      : [];
  return (
    <Tile data-testid="bridge-coins">
      <TileHeader aside="since launch · each epoch's claims at its open · violet on Aztec · grey on Ethereum">
        where the coins are
      </TileHeader>
      {points.length > 1 ? (
        <CoinsChart points={points} symbol={PARAMS.TOKEN_SYMBOL} />
      ) : (
        <p className="text-xs text-ink-3">
          {versions > 1
            ? `YACA is one pool across ${versions} versions: the split is drawn while one version has minted`
            : !snapshot.extras
              ? 'the portal’s events could not be read'
              : complete
                ? 'the epochs held so far draw nothing yet'
                : `drawn once every epoch since launch is held · ${rows.length} of ${Math.max(0, last - FIRST + 1)} so far`}
        </p>
      )}
    </Tile>
  );
}

function VersionCard({
  v,
  snapshot,
  miner,
  supply,
  now,
}: {
  v: VersionFlows;
  snapshot: BridgeSnapshot;
  miner: MinerFlows | undefined;
  supply: bigint | undefined;
  now: number;
}) {
  const live = v.version === snapshot.canonical.version;
  // Closed, frozen or pre-launch is Ethereum's word at the read; only the pause countdown moves with the clock.
  const chainTime = Number(snapshot.chainTime);
  const segments = whereOf(v, snapshot, miner, supply, import.meta.env.VITE_ROLLUP_VERSION);
  const closes =
    v.deadline === OPEN_ENDED
      ? 'the later of the version after next and 180 d after the flip, plus paused days'
      : `${day(v.deadline)} · plus paused days`;
  return (
    <Tile
      className={live ? 'border-uv' : undefined}
      data-testid="bridge-version"
      data-version={v.version.toString()}
      data-live={live ? '1' : '0'}
    >
      <div className="flex items-baseline justify-between gap-3">
        <b className="text-base font-semibold">Aztec V{v.version.toString()}</b>
        <Badge variant={live ? 'uv' : 'neutral'}>
          {live ? 'canonical' : v.flipAt > 0n ? 'flipped away from' : 'registered'}
        </Badge>
      </div>
      <p className="mt-1.5 text-sm" data-testid="version-line">
        {versionLine(v, snapshot.canonical)}
      </p>
      {snapshot.extras && <StackedBar segments={segments} className="mt-3.5" />}
      <p className="mt-3 text-pretty text-xs text-ink-2">
        {live ? `Launched ${day(v.launchAt)}. ` : ''}
        {yaca(v.exited)} left through the portal, {yaca(v.inbound)} arrived through it. YACA on Ethereum is
        one pool; these are V{v.version.toString()}’s flows.
      </p>
      <div className="mt-2">
        <KvRow label="headroom under the limit" value={yaca(v.headroom)} />
        <KvRow label="may ever have left by now" value={yaca(v.cap + v.inbound)} />
        <KvRow label="exits close" value={closes} />
      </div>
      <p className="mt-3 text-pretty text-xs text-ink-3" data-testid="exit-limit">
        {exitLimitLine(v, snapshot.policy, chainTime)}
      </p>
      <p className="mt-1.5 text-pretty text-xs text-ink-3" data-testid="pause-line">
        {pauseLine(v, snapshot.policy, chainNow(snapshot, now))}
      </p>
    </Tile>
  );
}

export function BridgeVersions({
  snapshot,
  miner,
  supply,
  now,
}: {
  snapshot: BridgeSnapshot;
  miner: MinerFlows | undefined;
  supply: bigint | undefined;
  now: number;
}) {
  return (
    <Tile data-testid="bridge-versions">
      <TileHeader aside="one card per Aztec rollup Yacana has lived on">versions</TileHeader>
      <div className="grid gap-3.5 md:grid-cols-2">
        {snapshot.versions.map((v) => (
          <VersionCard
            key={v.version.toString()}
            v={v}
            snapshot={snapshot}
            miner={miner}
            supply={supply}
            now={now}
          />
        ))}
      </div>
    </Tile>
  );
}

/** The portal as it stands: its state, the last forward, what waits, the exit limit and the pause. */
export function BridgeTurnstile({
  snapshot,
  live,
  miner,
  now,
  chainId,
}: {
  snapshot: BridgeSnapshot;
  live: VersionFlows | undefined;
  miner: MinerFlows | undefined;
  now: number;
  chainId: string;
}) {
  const p = snapshot.policy;
  const f = figuresOf(snapshot, live, miner, undefined);
  const forwarding = `by hand, Yacana or anyone · ${forwardingLine(f.lastForwardAt, chainNow(snapshot, now))}${
    f.forwards === undefined ? '' : ` · ${f.forwards} so far`
  }`;
  const dashed = (raw: bigint | undefined) => (raw === undefined ? '—' : yaca(raw));
  return (
    <Tile data-testid="bridge-turnstile">
      <TileHeader aside={`${chainName(chainId)} · ${live ? `V${live.version}` : 'this version'}`}>
        the portal
      </TileHeader>
      <KvRow
        label="state"
        value={
          <span className={live?.paused ? 'text-warn' : 'text-ok'}>{live?.paused ? 'paused' : 'open'}</span>
        }
      />
      <KvRow label="forwarding" value={forwarding} />
      <KvRow label="waiting to be forwarded" value={dashed(f.transit)} />
      <KvRow label="waiting to arrive on Aztec" value={dashed(f.waiting)} />
      <KvRow
        label="exit limit"
        value={live ? `${yaca(live.headroom)} may leave now · grows ${yaca(p.perHour)} an hour` : '—'}
      />
      <p className="mt-2 mb-2 text-pretty text-xs text-ink-3">
        A rate limit on exits, growing with the mining schedule since launch. An exit beyond it waits for the
        limit to grow; the flip freezes the limit and the deadline closes exits. Its purpose is to slow a
        drain long enough for the operators to pause.
      </p>
      <KvRow
        label="pause"
        value={live?.paused ? `paused · ${duration(Number(live.pausedSeconds))} spent` : 'not paused'}
      />
      <p className="mt-2 text-pretty text-xs text-ink-3">
        The operators may pause exits and deposits for up to {duration(Number(p.pauseMax))} at a time,{' '}
        {duration(Number(p.pauseBudget))} in total per version. Paused days extend when exits close.
      </p>
    </Tile>
  );
}

const key = (label: string, address: string, testId: string) => (
  <ChipLink label={label} value={address} href={l1Links.address(address)} testId={testId} />
);

/** The bridge on Ethereum: the keys that may act, where the contracts are, and the rules in plain words. */
export function BridgePortal({
  snapshot,
  record,
  live,
  className,
}: {
  snapshot: BridgeSnapshot;
  record: { portal: string; yaca: string; registry: string };
  live: VersionFlows | undefined;
  className?: string;
}) {
  const p = snapshot.policy;
  const v = live ? `V${live.version}` : 'a version';
  return (
    <Tile className={className} data-testid="bridge-portal">
      <TileHeader
        aside={
          <ExternalLink href={FAQ_HREF} className="text-ink-2">
            why the rule →
          </ExternalLink>
        }
      >
        the bridge on Ethereum
      </TileHeader>
      <div className="flex flex-wrap gap-2">
        {key('portal', record.portal, 'chip-portal')}
        {key('YACA', record.yaca, 'chip-yaca')}
        {key('registry', record.registry, 'chip-registry')}
        {key('operators', snapshot.operators, 'chip-operators')}
        {snapshot.forwarders.map((f) => key('forwarder', f, 'chip-forwarder'))}
      </div>
      <div className="mt-3">
        <KvRow label="who may add a version" value="the operators, once per version, never changed after" />
        <KvRow label="what a wrong version could do" value={`mint YACA up to ${v}’s schedule allowance`} />
        <KvRow
          label="who may pause"
          value={`the operators · ${duration(Number(p.pauseMax))} at a time · ${duration(Number(p.pauseBudget))} per version in all`}
        />
        <KvRow label="what a pause cannot do" value="keep an exit from landing once it lifts" />
        <KvRow
          label="who may forward"
          value="an exit: anyone · a held send-ahead: its holder, or a listed forwarder"
        />
        <KvRow
          label={`exit deadline for ${v}`}
          value="the later of the version after next and 180 d after the flip, plus paused days"
        />
      </div>
      <p className="mt-3 text-pretty text-xs text-ink-3">
        Exits from a version are capped at what mining could have produced: the limit grows {yaca(p.perHour)}{' '}
        an hour from {yaca(p.allowance)} at launch and freezes at the flip, net of what arrived. Before the
        flip, exits over it wait for it to grow; after the flip, what is beyond the frozen limit cannot leave,
        and nothing leaves a version after its deadline. The listed forwarders may forward a held send-ahead
        without its holder’s signature: a stranger could otherwise push it into a rollup about to stop.
      </p>
    </Tile>
  );
}

export function NoBridge({ className }: { className?: string }) {
  return (
    <Tile className={className} data-testid="no-bridge">
      <TileHeader>bridge</TileHeader>
      <p className="text-xs text-ink-3">
        This deployment has no bridge yet: no portal on Ethereum, nothing crosses.
      </p>
    </Tile>
  );
}
