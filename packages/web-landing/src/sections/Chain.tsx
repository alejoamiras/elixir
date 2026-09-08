import type { ExampleClaim } from '../../../site/src/config.ts';
import { ExternalLink, KvRow, shortHash, Tile, TileHeader } from '../../../ui/src/index.ts';
import { copy } from '../copy';
import { links } from '../explorer';
import { Section, SectionHeading, SectionLabel } from './Section';

/** The recorded claim this build ships, or null: the public tile then shows its labels with dashes. */
export const example: ExampleClaim | null = import.meta.env.VITE_EXAMPLE_CLAIM
  ? (JSON.parse(import.meta.env.VITE_EXAMPLE_CLAIM) as ExampleClaim)
  : null;

const l = copy.chain.ledger;
const DASH = '—';

/** A hash of the example, linked to its transaction's effects on the explorer. */
const Hash = ({ value, tx, testId }: { value: string; tx: string; testId: string }) => (
  <ExternalLink href={links.tx(tx)} full={value} className="text-ink" data-testid={testId}>
    {shortHash(value)}
  </ExternalLink>
);

export function LedgerPublic({ x }: { x: ExampleClaim | null }) {
  return (
    <Tile flat className="border-line-2" data-testid="ledger-public">
      <TileHeader
        aside={
          x && (
            <ExternalLink href={links.block(x.block)} full={String(x.block)} data-testid="ledger-block">
              block {x.block.toLocaleString('en-US')}
            </ExternalLink>
          )
        }
      >
        {l.public}
      </TileHeader>
      <KvRow
        label={l.nullifier}
        value={x ? <Hash value={x.nullifier} tx={x.txHash} testId="ledger-nullifier" /> : DASH}
      />
      <KvRow
        label={l.noteHash}
        value={x ? <Hash value={x.noteHash} tx={x.txHash} testId="ledger-note-hash" /> : DASH}
      />
      <KvRow
        label={x ? l.claims(x.epoch) : 'claims in the epoch'}
        value={x ? <span data-testid="ledger-claims">{`${x.claims[0]} → ${x.claims[1]}`}</span> : DASH}
      />
      <KvRow label={l.fee} value={x ? l.sponsor : DASH} />
    </Tile>
  );
}

function Private() {
  return (
    <Tile flat className="border-dashed" data-testid="ledger-private">
      <TileHeader>{l.private}</TileHeader>
      {l.rows.map((row) => (
        <KvRow key={row} label={row} value={DASH} />
      ))}
      <p className="mt-2 text-2xs text-ink-3">{l.handshake}</p>
    </Tile>
  );
}

export function Chain() {
  const c = copy.chain;
  return (
    <Section id="chain" className="grid gap-10 px-4 py-8 md:grid-cols-2 md:px-9">
      <div>
        <SectionLabel>what the chain sees</SectionLabel>
        <SectionHeading>{c.heading}</SectionHeading>
        <p className="text-pretty text-ink-2">{c.body}</p>
      </div>
      <div className="grid gap-3.5 sm:grid-cols-2" data-testid="ledger">
        <LedgerPublic x={example} />
        <Private />
      </div>
    </Section>
  );
}

export function How() {
  const h = copy.how;
  return (
    <Section id="how" className="px-4 py-8 md:px-9">
      <SectionLabel>{h.label}</SectionLabel>
      <SectionHeading>{h.heading}</SectionHeading>
      <ol className="grid gap-4 md:grid-cols-3" data-testid="how-steps">
        {h.steps.map((s, i) => (
          <Tile key={s.n} asChild>
            <li>
              <p className="mb-2 font-mono text-xs text-uv-2">
                {i + 1} · {s.n}
              </p>
              <h3 className="text-[14px] font-semibold leading-[1.45]">{s.title}</h3>
              <p className="mt-1.5 text-pretty text-xs text-ink-3">{s.body}</p>
            </li>
          </Tile>
        ))}
      </ol>
    </Section>
  );
}
