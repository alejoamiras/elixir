// The bridge page's tiles: the phases of the version this build carries, a card per registered
// version with what crossed it, the portal's turnstile in plain words, and the record's addresses.
// Flows per version, never balances: the portal knows what left and what arrived, not who holds what.

import type { VersionFlows } from '../../../bridge/src/portal-reader.ts';
import type { MigrationRecord } from '../../../bridge/src/record.ts';
import { PARAMS } from '../../../miner-core/src/generated/params.ts';
import { amount } from '../../../site/src/browser/format.ts';
import {
  Badge,
  ChipLink,
  ExternalLink,
  KvRow,
  Progress,
  Stepper,
  Tile,
  TileHeader,
} from '../../../ui/src/index.ts';
import {
  type BridgeSnapshot,
  chainNow,
  exitLimitLine,
  pauseLine,
  phasesOf,
  versionLine,
} from '../bridge-beat';
import { l1Links } from '../explorer';
import { FAQ_HREF } from '../routes';

const yaca = (raw: bigint) => `${amount(raw, PARAMS.DECIMALS, 2)} ${PARAMS.TOKEN_SYMBOL}`;
const percent = (part: bigint, whole: bigint) => (whole === 0n ? 0 : Number((part * 1000n) / whole) / 10);

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
        this version's phases
      </TileHeader>
      {version ? (
        <Stepper steps={phasesOf(version, migration, nowSeconds)} />
      ) : (
        <p className="text-xs text-ink-3">reading the portal…</p>
      )}
    </Tile>
  );
}

function VersionCard({ v, snapshot, now }: { v: VersionFlows; snapshot: BridgeSnapshot; now: number }) {
  const live = v.version === snapshot.canonical.version;
  // Closed, frozen or pre-launch is Ethereum's word at the read; only the pause countdown moves with the clock.
  const chainTime = Number(snapshot.chainTime);
  return (
    <Tile data-testid="bridge-version" data-version={v.version.toString()} data-live={live ? '1' : '0'}>
      <TileHeader aside={live ? <Badge variant="uv">live</Badge> : undefined}>
        V{v.version.toString()}
      </TileHeader>
      <p className="mb-3 text-sm" data-testid="version-line">
        {versionLine(v, snapshot.canonical)}
      </p>
      <KvRow label="left through the portal" value={yaca(v.exited)} />
      <KvRow label="arrived through it" value={yaca(v.inbound)} />
      <KvRow label="headroom under the limit" value={yaca(v.headroom)} />
      <KvRow label="may ever have left by now" value={yaca(v.cap + v.inbound)} />
      <Progress
        className="mt-3"
        value={percent(v.exited, v.cap + v.inbound)}
        aria-label="left, of the limit"
      />
      <p className="mt-3 text-xs text-ink-3" data-testid="exit-limit">
        {exitLimitLine(v, snapshot.policy, chainTime)}
      </p>
      <p className="mt-1.5 text-xs text-ink-3" data-testid="pause-line">
        {pauseLine(v, snapshot.policy, chainNow(snapshot, now))}
      </p>
    </Tile>
  );
}

export function BridgeVersions({ snapshot, now }: { snapshot: BridgeSnapshot; now: number }) {
  return (
    <>
      {snapshot.versions.map((v) => (
        <VersionCard key={v.version.toString()} v={v} snapshot={snapshot} now={now} />
      ))}
    </>
  );
}

const key = (label: string, address: string, testId: string) => (
  <ChipLink label={label} value={address} href={l1Links.address(address)} testId={testId} />
);

/** The portal in plain words: the rule, the keys that may act, and where the contracts are. */
export function BridgePortal({
  snapshot,
  record,
  className,
}: {
  snapshot: BridgeSnapshot;
  record: { portal: string; yaca: string; registry: string };
  className?: string;
}) {
  const p = snapshot.policy;
  return (
    <Tile className={className} data-testid="bridge-portal">
      <TileHeader>the portal, in plain words</TileHeader>
      <p className="text-pretty text-xs text-ink-3">
        Exits from a version are capped at what mining could have produced: the limit grows {yaca(p.perHour)}{' '}
        an hour from {yaca(p.allowance)} at launch and freezes at the flip, net of what arrived. Before the
        flip, exits over it wait for it to grow; after the flip, what is beyond the frozen limit cannot leave,
        and nothing leaves a version after its deadline. Yacana forwards exits by hand; the holder may forward
        or redeem a held send-ahead from the miner while the version's exits are open. Deposits into a version
        close when the operators say so before an announced flip.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {key('portal', record.portal, 'chip-portal')}
        {key('YACA', record.yaca, 'chip-yaca')}
        {key('registry', record.registry, 'chip-registry')}
        {key('operators', snapshot.operators, 'chip-operators')}
        {snapshot.forwarders.map((f) => key('forwarder', f, 'chip-forwarder'))}
      </div>
      <p className="mt-3 text-xs text-ink-3">
        The listed forwarders may forward a held send-ahead without its holder's signature; anyone may forward
        an exit to Ethereum.{' '}
        <ExternalLink href={FAQ_HREF} className="text-ink-2">
          why the rule →
        </ExternalLink>
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
