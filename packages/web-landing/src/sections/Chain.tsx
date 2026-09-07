import { KvRow, Marks, Tile } from '../../../ui/src/index.ts';
import { copy, LINKS } from '../copy';
import { Section, SectionHeading, SectionLabel } from './Section';

export function Chain() {
  const c = copy.chain;
  return (
    <Section id="chain" className="grid gap-10 px-4 py-8 md:grid-cols-2 md:px-9">
      <div>
        <SectionLabel>what the chain sees</SectionLabel>
        <SectionHeading>{c.heading}</SectionHeading>
        <p className="text-pretty text-ink-2">{c.body}</p>
        <div className="mt-3.5" data-testid="chain-marks">
          <Marks nullifier="0x2f9a…c41e" noteHash="0x77b0…19d2" claims={[3, 4]} suffix="illustrative" />
        </div>
      </div>
      <div>
        <p className="mb-3 text-pretty text-ink-2">{c.holding}</p>
        <div data-testid="chain-footprint">
          {c.footprint.map((f) => (
            <KvRow key={f.k} label={f.k} value={f.v} className="[&>:last-child]:text-right" />
          ))}
        </div>
      </div>
    </Section>
  );
}

export function How() {
  const h = copy.how;
  return (
    <Section id="how" className="px-4 py-8 md:px-9">
      <SectionLabel as="h2" className="mb-3.5">
        {h.heading}
      </SectionLabel>
      <ol className="grid gap-4 md:grid-cols-3" data-testid="how-steps">
        {h.steps.map((s, i) => (
          <Tile key={s.n} asChild>
            <li>
              <p className="mb-2 font-mono text-xs text-uv-2">
                {i + 1} · {s.n}
              </p>
              <h3 className="font-semibold">{s.title}</h3>
              <p className="mt-1.5 text-pretty text-xs text-ink-3">{s.body}</p>
            </li>
          </Tile>
        ))}
      </ol>
      <a href={LINKS.docs} className="mt-3.5 inline-block text-xs text-ink-3 hover:text-ink">
        {h.more}
      </a>
    </Section>
  );
}
