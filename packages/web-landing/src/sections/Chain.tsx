import { copy, LINKS } from '../copy';
import { Section } from './Section';

export function Chain() {
  const c = copy.chain;
  return (
    <Section id="chain" eyebrow="what the chain sees" heading={c.heading}>
      <div className="grid gap-8 md:grid-cols-2">
        <div className="flex flex-col gap-4 text-pretty text-ink-2">
          <p>{c.body}</p>
          <p>{c.holding}</p>
        </div>
        <dl className="flex flex-col gap-3" data-testid="chain-footprint">
          {c.footprint.map((f) => (
            <div key={f.k} className="rounded-md border border-line bg-panel px-4 py-3">
              <dt className="font-mono text-2xs text-ink-2 uppercase">{f.k}</dt>
              <dd className="font-mono text-sm">{f.v}</dd>
            </div>
          ))}
        </dl>
      </div>
    </Section>
  );
}

export function How() {
  const h = copy.how;
  return (
    <Section id="how" eyebrow="how it works" heading={h.heading}>
      <ol className="grid gap-4 md:grid-cols-3" data-testid="how-steps">
        {h.steps.map((s, i) => (
          <li key={s.n} className="flex flex-col gap-2 rounded-md border border-line bg-panel p-4">
            <p className="font-mono text-2xs text-ink-2 uppercase">
              {i + 1} · {s.n}
            </p>
            <h3 className="text-lg font-semibold">{s.title}</h3>
            <p className="text-pretty text-sm text-ink-2">{s.body}</p>
          </li>
        ))}
      </ol>
      <a href={LINKS.docs} className="text-sm text-ink-2 underline underline-offset-4 hover:text-ink">
        {h.more}
      </a>
    </Section>
  );
}
