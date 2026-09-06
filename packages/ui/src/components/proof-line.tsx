import type * as React from 'react';
import { cn } from '../lib/cn.ts';

/** The ledger's line grammar: ★ win · ✓ minted · ✗ failed · ── epoch; plain lines are attempts. */
export type ProofLine =
  | { kind: 'attempt'; time: string; n: number; score: number; proveMs: number; best?: boolean }
  | { kind: 'win'; time: string; n: number; score: number; proveMs: number }
  | { kind: 'minted'; time: string; text: string; chain?: string }
  | { kind: 'failed'; time: string; text: string }
  | { kind: 'epoch'; time: string; text: string };

export const LEDGER_WINDOW = 200;

const GLYPH: Record<ProofLine['kind'], string> = {
  attempt: '',
  win: '★',
  minted: '✓',
  failed: '✗',
  epoch: '──',
};

const TONE: Record<ProofLine['kind'], string> = {
  attempt: 'text-ink-2',
  win: 'text-uv-2 animate-pulse [animation-iteration-count:1]',
  minted: 'text-ok',
  failed: 'text-bad',
  epoch: 'text-ink-3',
};

const seconds = (ms: number) => `${(ms / 1000).toFixed(2)} s`;

function Attempt({ line }: { line: Extract<ProofLine, { n: number }> }) {
  return (
    <>
      <span className="text-ink-2">#{line.n}</span>
      <span className={line.kind === 'attempt' ? 'text-ink' : undefined}>score {line.score.toFixed(1)}</span>
      <span className="text-ink-2">{seconds(line.proveMs)}</span>
      {line.kind === 'attempt' && line.best && <span className="text-uv-2">best this epoch</span>}
    </>
  );
}

function Event({ line }: { line: Extract<ProofLine, { text: string }> }) {
  return (
    <>
      <span>{line.text}</span>
      {line.kind === 'minted' && line.chain && <span className="text-ink-2">{line.chain}</span>}
      {line.kind === 'epoch' && <span aria-hidden>──</span>}
    </>
  );
}

function Line({ line }: { line: ProofLine }) {
  return (
    <li
      data-slot="proof-line"
      data-kind={line.kind}
      className={cn(
        'flex gap-3 py-0.5 font-mono text-xs whitespace-nowrap animate-in fade-in slide-in-from-top-1 duration-[120ms] motion-reduce:animate-none',
        TONE[line.kind],
      )}
    >
      <span className="text-ink-2">{line.time}</span>
      {GLYPH[line.kind] && (
        <span>
          <span aria-hidden>{GLYPH[line.kind]}</span>
          <span className="sr-only">{line.kind}</span>
        </span>
      )}
      {'n' in line ? <Attempt line={line} /> : <Event line={line} />}
    </li>
  );
}

/** Newest first; keeps the last LEDGER_WINDOW lines in the DOM. */
export function ProofLedger({
  lines,
  className,
  ...props
}: React.ComponentProps<'ol'> & { lines: readonly (ProofLine & { id: string | number })[] }) {
  return (
    <ol data-slot="proof-ledger" className={cn('m-0 list-none p-0', className)} {...props}>
      {lines.slice(0, LEDGER_WINDOW).map((line) => (
        <Line key={line.id} line={line} />
      ))}
    </ol>
  );
}
