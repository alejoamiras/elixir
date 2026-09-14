// `/faq`, under the landing's header: the migration in six panels, then the questions the pages
// link to — the forwarding rule and its reason, what is public, what can go wrong. Served by the
// origin's SPA fallback, so a link from any app lands here.
import { Button } from '../../../ui/src/index.ts';
import { copy } from '../copy';
import { appHref } from '../state';

const STATS_BRIDGE = `${import.meta.env.BASE_URL}stats/bridge`;

export function Faq() {
  const f = copy.faq;
  return (
    <main className="mx-auto flex max-w-[720px] flex-col gap-10 px-4 py-11 md:px-5" data-testid="faq">
      <header className="flex flex-col gap-3">
        <a href={import.meta.env.BASE_URL} className="text-sm text-ink-2 hover:text-ink">
          {f.back}
        </a>
        <h1 className="text-balance text-[36px] font-semibold leading-[1.02] tracking-[-0.03em]">
          {f.title}
        </h1>
        <p className="text-pretty text-ink-2">{f.lede}</p>
      </header>
      <ol className="grid list-none gap-3 p-0 sm:grid-cols-2 lg:grid-cols-3" data-testid="faq-panels">
        {f.panels.map((p, i) => (
          <li
            key={p.id}
            data-testid="faq-panel"
            className="flex flex-col gap-2 rounded-[8px] border border-line bg-raised px-4 py-3.5"
          >
            <span className="label-mono text-uv-2">{i + 1}</span>
            <h2 className="text-balance font-semibold leading-tight">{p.title}</h2>
            <p className="text-pretty text-sm text-ink-2">{p.body}</p>
          </li>
        ))}
      </ol>
      <dl className="flex flex-col gap-6" data-testid="faq-questions">
        {f.questions.map((x) => (
          <div key={x.q}>
            <dt className="text-balance font-semibold">{x.q}</dt>
            <dd className="mt-1.5 text-pretty text-sm text-ink-2">{x.a}</dd>
          </div>
        ))}
      </dl>
      <div className="flex flex-wrap gap-2.5">
        <Button variant="uv" size="lg" asChild>
          <a href={appHref('mine')} data-testid="faq-mine">
            {f.mine}
          </a>
        </Button>
        <Button size="lg" asChild>
          <a href={STATS_BRIDGE} data-testid="faq-stats">
            {f.stats}
          </a>
        </Button>
      </div>
    </main>
  );
}
