import { useAtomValue } from 'jotai';
import type { ReactNode } from 'react';
import type { Connection } from '../../site/src/browser/connection.ts';
import { duration } from '../../site/src/browser/format.ts';
import { Alert, AlertDescription, AlertTitle, Badge, cn, Mark } from '../../ui/src/index.ts';
import { navigate, type Route, useRoute } from './routes';
import { Stats } from './routes/Stats';
import { Verify } from './routes/Verify';
import { chainAtom, nowAtom, statusAtom } from './state';

const NAV: { route: Route; label: string }[] = [
  { route: 'stats', label: 'Stats' },
  { route: 'verify', label: 'Verify' },
];

/** "block 184,221 · 12 s ago": the last block the node showed and the age of its slot time. */
function Freshness() {
  const chain = useAtomValue(chainAtom);
  const status = useAtomValue(statusAtom);
  const now = useAtomValue(nowAtom);
  if (!chain)
    return (
      <span className="font-mono text-2xs text-ink-2">{status.phase === 'loading' ? status.step : ''}</span>
    );
  const age = Math.max(0, Math.floor(now / 1000) - chain.block.timestamp);
  return (
    <span className="font-mono text-2xs text-ink-2" data-testid="freshness">
      block {chain.block.number.toLocaleString('en-US')} · {duration(age)} ago
    </span>
  );
}

function Shell({ children, connection }: { children: ReactNode; connection: Connection }) {
  const route = useRoute();
  const status = useAtomValue(statusAtom);
  const minerHref = `${import.meta.env.BASE_URL.replace(/\/stats\/?$/, '')}/mine/`;
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4 p-4 md:p-8">
      <header className="flex h-[52px] items-center gap-5 border-b border-line">
        <span className="flex items-center gap-2 font-semibold">
          <Mark state={status.phase === 'ready' ? 'mining' : 'idle'} />
          Yacana
        </span>
        <nav className="flex gap-4 text-sm" aria-label="stats">
          {NAV.map((n) => (
            <a
              key={n.route}
              href={`#${n.route}`}
              aria-current={route === n.route ? 'page' : undefined}
              onClick={(e) => {
                e.preventDefault();
                navigate(n.route);
              }}
              className={cn(
                'py-1 text-ink-2 hover:text-ink',
                route === n.route && 'text-ink underline underline-offset-[18px]',
              )}
            >
              {n.label}
            </a>
          ))}
          <a href={minerHref} className="py-1 text-ink-2 hover:text-ink">
            Miner ↗
          </a>
        </nav>
        <span className="ml-auto flex items-center gap-3">
          <Badge variant="warn">testnet</Badge>
          <Freshness />
        </span>
      </header>
      {status.phase === 'unreachable' && (
        <Alert variant="warn" data-testid="unreachable">
          <AlertTitle>node unreachable</AlertTitle>
          <AlertDescription>
            No answer from {new URL(connection.nodeUrl).host} since{' '}
            {new Date(status.since).toISOString().slice(11, 19)}; the numbers below are from the last read.
          </AlertDescription>
        </Alert>
      )}
      {status.phase === 'error' && (
        <Alert variant="bad" data-testid="boot-error">
          <AlertTitle>Cannot read this deployment</AlertTitle>
          <AlertDescription>{status.message}</AlertDescription>
        </Alert>
      )}
      {children}
      <footer className="flex flex-wrap gap-x-4 gap-y-1 border-t border-line pt-3 text-2xs text-ink-2">
        <span>© Yacana · read from public storage · no trackers</span>
        <span data-testid="node">node {new URL(connection.nodeUrl).host}</span>
        <span className="font-mono">source {import.meta.env.VITE_SOURCE_COMMIT.slice(0, 12)}</span>
      </footer>
    </div>
  );
}

export function App({ connection, onOlder }: { connection: Connection; onOlder: () => void }) {
  const route = useRoute();
  return (
    <Shell connection={connection}>
      {route === 'stats' && <Stats onOlder={onOlder} />}
      {route === 'verify' && <Verify nodeUrl={connection.nodeUrl} />}
    </Shell>
  );
}
