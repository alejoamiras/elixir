// The stats routes' frame in the miner's own chunk: the pages load on first opening, and a load that
// fails stays on this card while the cockpit, the prover and the mini window carry on.
import { Alert, AlertDescription, Button, type StatsTab } from '@yacana/ui';
import type { Connection } from '@yacana/web-kit/browser/connection';
import { Component, lazy, type ReactNode, Suspense, useState } from 'react';
import { redeployed, servedBuild } from '../bridge/env';

const load = () => import('../routes/Stats');

class LoadBoundary extends Component<
  { onRetry: () => void; children: ReactNode },
  { failed: boolean; redeployed: boolean }
> {
  state = { failed: false, redeployed: false };

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }

  componentDidCatch(): void {
    void servedBuild().then((b) => this.setState({ redeployed: redeployed(b) }));
  }

  render(): ReactNode {
    if (!this.state.failed) return this.props.children;
    const gone = this.state.redeployed;
    return (
      <Alert variant="bad" data-testid="stats-unavailable" data-redeployed={gone || undefined}>
        <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
          <span>
            {gone
              ? 'Yacana has been updated since this tab opened: Stats opens after a reload, which stops mining.'
              : 'Stats could not be fetched. Mining goes on.'}
          </span>
          <Button
            size="sm"
            variant="danger"
            onClick={gone ? () => location.reload() : this.props.onRetry}
            data-testid="stats-retry"
          >
            {gone ? 'Reload to open Stats' : 'Try again'}
          </Button>
        </AlertDescription>
      </Alert>
    );
  }
}

export function StatsRoute({ page, connection }: { page: StatsTab; connection: Connection }) {
  // A fresh import() per attempt: React.lazy keeps a rejected load for good.
  const [attempt, setAttempt] = useState(() => ({ n: 0, Stats: lazy(load) }));
  const { Stats } = attempt;
  return (
    <LoadBoundary key={attempt.n} onRetry={() => setAttempt(({ n }) => ({ n: n + 1, Stats: lazy(load) }))}>
      <Suspense fallback={null}>
        <Stats page={page} connection={connection} />
      </Suspense>
    </LoadBoundary>
  );
}
