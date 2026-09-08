// The loop header while a claim is in flight, the marks once it minted, the card when it did not.
import { useAtomValue } from 'jotai';
import { PARAMS } from '../../../miner-core/src/generated/params.ts';
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Button,
  Marks,
  type Step,
  Stepper,
} from '../../../ui/src/index.ts';
import type { ClaimProgress, Minted, Notice } from '../lib/reducer';
import { nowAtom, rulesAtom } from '../state';

const STEPS: ClaimProgress['step'][] = ['proving', 'sent', 'waiting'];
const LABEL: Record<ClaimProgress['step'], string> = {
  proving: 'proving the claim in-page',
  sent: 'sent to the node',
  waiting: 'in a block · syncing the note',
};

const mmss = (s: number): string => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

/** The second line of the `sent` step: the sequencer's deadline, counted down. */
export const ttlDetail = (expiresAt: number | undefined, nowMs: number): string => {
  if (expiresAt === undefined) return 'expiry unknown';
  const left = expiresAt - nowMs / 1000;
  return left > 0 ? `drops in ${mmss(left)} if not included` : 'past its time-to-live';
};

export const claimSteps = (claim: ClaimProgress, nowMs: number): Step[] => {
  const current = STEPS.indexOf(claim.step);
  return STEPS.map((id, i) => {
    const state = i < current ? 'done' : i === current ? 'active' : 'pending';
    const ms = i < current ? claim.done[i] : i === current ? Math.max(0, nowMs - claim.since) : undefined;
    const detail = id === 'sent' && state !== 'pending' ? ttlDetail(claim.expiresAt, nowMs) : undefined;
    return { id, label: LABEL[id], state, ms, detail };
  });
};

export function ClaimStepper({ claim }: { claim: ClaimProgress }) {
  const now = useAtomValue(nowAtom);
  return <Stepper steps={claimSteps(claim, now)} data-testid="claim-stepper" />;
}

export function MintedMarks({ minted }: { minted: Minted }) {
  const rules = useAtomValue(rulesAtom);
  const closed = rules && minted.claims[1] >= rules.N;
  return (
    <div data-testid="minted" className="flex flex-col gap-2">
      <p className="text-xs text-ink-2">
        this transaction's effects · block {minted.block.toLocaleString('en-US')} · {PARAMS.TOKEN_SYMBOL}{' '}
        minted privately
      </p>
      <Marks
        nullifier={minted.nullifier}
        noteHash={minted.noteHash}
        moreNotes={minted.noteHashes - 1}
        claims={minted.claims}
        suffix={closed ? 'epoch closed' : undefined}
      />
    </div>
  );
}

const VARIANT: Record<Notice['kind'], 'bad' | 'warn' | 'neutral'> = {
  reverted: 'warn',
  expired: 'neutral',
  failed: 'bad',
  'prover-dead': 'bad',
  offline: 'warn',
  paused: 'warn',
};

/** The card under the loop. A reverted claim offers the fresh-key route; a dead prover a reload. */
export function NoticeCard({ notice, recovering }: { notice: Notice; recovering: boolean }) {
  const now = useAtomValue(nowAtom);
  const minutes = notice.until ? Math.max(0, Math.ceil((notice.until - now) / 60_000)) : undefined;
  return (
    <Alert variant={VARIANT[notice.kind]} data-testid={`notice-${notice.kind}`}>
      <AlertTitle>{notice.title}</AlertTitle>
      <AlertDescription data-testid="miner-error">{notice.body}</AlertDescription>
      {minutes !== undefined && <p className="mt-1 font-mono text-2xs">resumes in ~{minutes} min</p>}
      {(notice.kind === 'reverted' || notice.kind === 'paused') && !recovering && (
        <div className="mt-2">
          <Button size="sm" onClick={() => location.reload()} data-testid="fresh-key">
            Use another account
          </Button>
        </div>
      )}
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
