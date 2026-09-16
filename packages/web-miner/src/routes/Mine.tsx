import { useAtomValue } from 'jotai';
import { useState } from 'react';
import { TileBoundary } from '../../../ui/src/index.ts';
import { isOldRole } from '../bridge/env';
import { BalanceCard } from '../components/BalanceCard';
import type { MinerController } from '../controller';
import { BridgeProviders } from '../features/BridgeProviders';
import { NoticeCard } from '../features/ClaimStatus';
import { SendAheadDialog } from '../features/dialogs/SendAhead';
import { LedgerTile } from '../features/LedgerTile';
import { KpiTiles, LoopTile } from '../features/LoopTile';
import { MigrationCard } from '../features/MigrationCard';
import { OldApp } from '../features/OldApp';
import { RailTile } from '../features/RailTile';
import { useTileLog } from '../lib/tile-log';
import type { Session } from '../session';
import { balanceAtom, bootAtom, minerAtom } from '../state';

/** The guided path over the cockpit: the upgrade card with the send-ahead dialog; what arrives shows in the Wallet. */
function GuidedPath({ session }: { session: Session }) {
  const onError = useTileLog();
  const balance = useAtomValue(balanceAtom);
  const [ahead, setAhead] = useState<false | 'form' | 'how'>(false);
  return (
    <BridgeProviders>
      <TileBoundary name="migration" onError={onError} className="md:col-span-2 xl:col-span-4">
        <MigrationCard
          onSendAhead={() => setAhead('form')}
          onHow={() => setAhead('how')}
          className="md:col-span-2 xl:col-span-4"
        />
      </TileBoundary>
      <SendAheadDialog
        session={session}
        balance={balance ?? 0n}
        open={ahead !== false}
        initial={ahead || 'form'}
        onOpenChange={(o) => !o && setAhead(false)}
      />
    </BridgeProviders>
  );
}

/**
 * The ledger and the balance tile share a wrapper so that between `md` and `xl` they stack beside the
 * rail; at `xl` it dissolves (`contents`) and the grid places them itself.
 */
export function Mine({
  controller,
  onStart,
  session,
}: {
  controller: () => MinerController | undefined;
  /** The user's Start (through the session, which re-asks Presto); a bare controller start otherwise. */
  onStart?: () => void;
  /** The bridge's session, when the page has one: the guided path renders over the cockpit. */
  session?: Session;
}) {
  const onError = useTileLog();
  const ready = useAtomValue(bootAtom).phase === 'ready';
  const notice = useAtomValue(minerAtom).notice;
  // The versioned origin is one page: nothing is mined there, so no cockpit.
  if (isOldRole()) return <OldApp session={session} />;
  return (
    <div
      className="grid items-start gap-[14px] md:grid-cols-2 xl:grid-cols-[1fr_1fr_1fr_300px]"
      data-signed-out={ready ? undefined : ''}
      data-testid="cockpit"
    >
      {notice && (
        <div className="md:col-span-2 xl:col-span-4">
          <NoticeCard notice={notice} />
        </div>
      )}
      {session && ready && <GuidedPath session={session} />}
      <TileBoundary name="loop" onError={onError} className="md:col-span-2 xl:col-span-3">
        <LoopTile
          controller={controller}
          onStart={onStart ?? (() => controller()?.start())}
          className="md:col-span-2 xl:col-span-3"
        />
      </TileBoundary>
      <TileBoundary name="rail" onError={onError} className="md:order-3 xl:order-none xl:row-span-2">
        <RailTile controller={controller} className="md:order-3 xl:order-none xl:row-span-2" />
      </TileBoundary>
      <TileBoundary name="kpis" onError={onError} className="md:col-span-2 xl:col-span-3">
        <KpiTiles className="md:col-span-2 xl:col-span-3" />
      </TileBoundary>
      <div className="contents md:order-4 md:flex md:flex-col md:gap-[14px] xl:contents">
        <TileBoundary name="ledger" onError={onError} className="xl:col-span-3">
          <LedgerTile controller={controller} className="xl:col-span-3" />
        </TileBoundary>
        <TileBoundary name="balance" onError={onError}>
          <BalanceCard />
        </TileBoundary>
      </div>
    </div>
  );
}
