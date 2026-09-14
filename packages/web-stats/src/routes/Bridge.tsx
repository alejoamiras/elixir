// `/stats/bridge`: the phases of this build's version first, a card per registered version, the
// portal in plain words. Everything comes from one read of the portal over the Ethereum RPC.
import { useAtomValue } from 'jotai';
import type { BridgeRecord, MigrationRecord } from '../../../bridge/src/record.ts';
import { Alert, AlertDescription, AlertTitle, TileBoundary } from '../../../ui/src/index.ts';
import { BridgePhases, BridgePortal, BridgeVersions, NoBridge } from '../features/Bridge';
import { bridgeAtom, nowAtom } from '../state';

const record = (): BridgeRecord | null =>
  import.meta.env.VITE_BRIDGE ? (JSON.parse(import.meta.env.VITE_BRIDGE) as BridgeRecord) : null;
const migration = (): MigrationRecord | null =>
  import.meta.env.VITE_MIGRATION ? (JSON.parse(import.meta.env.VITE_MIGRATION) as MigrationRecord) : null;

export function Bridge() {
  const status = useAtomValue(bridgeAtom);
  const now = useAtomValue(nowAtom);
  const bridge = record();
  if (!bridge || status.phase === 'none') return <NoBridge />;
  const snapshot = status.phase === 'ready' ? status.snapshot : null;
  const mine = snapshot?.versions.find((v) => v.version.toString() === import.meta.env.VITE_ROLLUP_VERSION);
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2" data-testid="bridge">
      {status.phase === 'error' && (
        <Alert variant="bad" className="md:col-span-2" data-testid="bridge-error">
          <AlertTitle>Cannot read the portal</AlertTitle>
          <AlertDescription>{status.message}</AlertDescription>
        </Alert>
      )}
      {status.phase === 'ready' && status.unreachable && (
        <Alert variant="warn" className="md:col-span-2" data-testid="bridge-stale">
          <AlertDescription>
            The Ethereum RPC is not answering; these are the last numbers read.
          </AlertDescription>
        </Alert>
      )}
      <TileBoundary name="bridge-phases" className="md:col-span-2">
        <BridgePhases
          className="md:col-span-2"
          version={mine}
          migration={migration()}
          nowSeconds={snapshot ? Number(snapshot.chainTime) : Math.floor(now / 1000)}
        />
      </TileBoundary>
      {snapshot && <BridgeVersions snapshot={snapshot} now={now} />}
      {snapshot && (
        <TileBoundary name="bridge-portal" className="md:col-span-2">
          <BridgePortal className="md:col-span-2" snapshot={snapshot} record={bridge} />
        </TileBoundary>
      )}
    </div>
  );
}
