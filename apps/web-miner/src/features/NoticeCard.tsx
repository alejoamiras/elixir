// The card under the header when a claim did not mint, or the node or the prover went away.

import { Alert, AlertDescription, AlertTitle, Button } from '@yacana/ui';
import { useAtomValue } from 'jotai';
import type { Notice } from '../lib/reducer';
import { nowAtom } from '../state';

const VARIANT: Record<Notice['kind'], 'bad' | 'warn' | 'neutral'> = {
  reverted: 'warn',
  failed: 'bad',
  'prover-dead': 'bad',
  offline: 'warn',
  behind: 'warn',
  paused: 'warn',
};

/** The banner under the header: a lost race, the pause until finality, a silent node, a dead prover (reload). */
export function NoticeCard({ notice }: { notice: Notice }) {
  const now = useAtomValue(nowAtom);
  const minutes = notice.until ? Math.max(0, Math.ceil((notice.until - now) / 60_000)) : undefined;
  return (
    <Alert variant={VARIANT[notice.kind]} data-testid={`notice-${notice.kind}`}>
      <AlertTitle>{notice.title}</AlertTitle>
      <AlertDescription data-testid="miner-error">{notice.body}</AlertDescription>
      {minutes !== undefined && <p className="mt-1 font-mono text-2xs">in {minutes} min</p>}
      {notice.kind === 'prover-dead' && (
        <div className="mt-2">
          <Button size="sm" onClick={() => location.reload()}>
            Reload
          </Button>
        </div>
      )}
    </Alert>
  );
}
