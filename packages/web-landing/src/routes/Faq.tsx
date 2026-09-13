// `/faq`, under the landing's header: the eyebrow and the title, three sections of
// question rows (the question on the left, the answer on the right), the six panels of the
// upgrade as a strip with their coin marks. Served by the origin's SPA fallback, so a link from
// any app lands here.
import { Button, cn } from '../../../ui/src/index.ts';
import { copy } from '../copy';
import { faq } from '../faq-copy';
import { appHref } from '../state';

const STATS_BRIDGE = `${import.meta.env.BASE_URL}stats/bridge`;

/** Where the coin is at each step: on Aztec (violet), crossing (dashed), on Ethereum (grey). */
const COIN: Record<string, string> = {
  announced: 'bg-uv',
  send: 'border-[1.5px] border-dashed border-uv-2 bg-transparent',
  proven: 'border-[1.5px] border-dashed border-uv-2 bg-transparent',
  held: 'bg-ink-3',
  flip: 'border-[1.5px] border-dashed border-uv-2 bg-transparent',
  landed: 'bg-uv',
};

function Panels() {
  return (
    <ol
      className="my-2 mb-4 grid list-none gap-2.5 p-0 sm:grid-cols-2 lg:grid-cols-6"
      data-testid="faq-panels"
    >
      {copy.faq.panels.map((p, i) => (
        <li
          key={p.id}
          data-testid="faq-panel"
          className={cn(
            'relative flex min-h-[120px] flex-col gap-2 rounded-[8px] border px-3 pb-3.5 pt-3',
            p.id === 'held' ? 'border-line-2 bg-panel' : i >= 4 ? 'border-uv' : 'border-line-2',
          )}
        >
          <span className="label-mono text-uv-2">
            {i + 1} · {p.id === 'held' ? 'ethereum' : p.id}
          </span>
          <b className="text-balance text-sm font-semibold leading-[1.3]">{p.title}</b>
          <span className="text-pretty text-xs leading-[1.45] text-ink-2">{p.body}</span>
          <i
            aria-hidden
            className={cn(
              'absolute top-3 right-3 size-[18px] rounded-full border-2 border-ground',
              COIN[p.id] ?? 'bg-uv',
            )}
          />
        </li>
      ))}
    </ol>
  );
}

export function Faq() {
  const f = copy.faq;
  return (
    <main className="mx-auto flex max-w-[1120px] flex-col gap-9 px-4 py-10 md:px-5" data-testid="faq">
      <div className="flex flex-col gap-2.5">
        <a href={import.meta.env.BASE_URL} className="text-sm text-ink-2 hover:text-ink">
          {f.back}
        </a>
        <span className="font-mono text-[11.5px] uppercase tracking-[0.14em] text-uv-2">{faq.eyebrow}</span>
        <h1 className="text-balance text-[40px] font-semibold leading-[1.02] tracking-[-0.025em]">
          {faq.title}
        </h1>
      </div>
      <div className="flex flex-col gap-9" data-testid="faq-questions">
        {faq.sections.map((s) => (
          <div key={s.id} data-testid={`faq-${s.id}`}>
            <h2 className="mb-3.5 text-[22px] font-semibold tracking-[-0.015em]">{s.title}</h2>
            {s.lede && <p className="mb-1.5 max-w-[72ch] text-pretty text-sm text-ink-2">{s.lede}</p>}
            {s.panels && <Panels />}
            <dl className="m-0 flex flex-col">
              {s.questions.map((x) => (
                <div
                  key={x.q}
                  className="grid gap-2 border-t border-line py-3.5 md:grid-cols-[260px_1fr] md:gap-5"
                >
                  <dt className="text-balance text-[15px] font-semibold leading-[1.35]">{x.q}</dt>
                  <dd className="m-0 max-w-[66ch] text-pretty text-sm leading-[1.55] text-ink-2">{x.a}</dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
      </div>
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
