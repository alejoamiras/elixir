import { Button } from '../../../ui/src/index.ts';
import { copy } from '../copy';
import { useMobile } from '../hooks';
import { appHref } from '../state';

export function Ask() {
  const mobile = useMobile();
  return (
    <section
      id="ask"
      className="flex flex-col items-start gap-6 border-t border-line py-20"
      data-testid="ask"
    >
      <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">{copy.ask.heading}</h2>
      <div className="flex flex-wrap gap-3">
        {!mobile && (
          <Button variant="primary" size="lg" asChild>
            <a href={appHref('mine')}>{copy.bar.mine}</a>
          </Button>
        )}
        <Button size="lg" asChild>
          <a href={appHref('stats')}>{copy.ask.watch}</a>
        </Button>
      </div>
    </section>
  );
}

export function Footer() {
  const f = copy.footer;
  return (
    <footer className="flex flex-col gap-3 border-t border-line py-8 text-xs text-ink-2 md:flex-row md:items-center md:justify-between">
      <p data-testid="footer-line">© Yacana · {f.line}</p>
      <nav className="flex flex-wrap gap-4" aria-label="footer">
        {f.links.map((l) => (
          <a key={l.label} href={l.href === 'stats' ? appHref('stats') : l.href} className="hover:text-ink">
            {l.label}
          </a>
        ))}
      </nav>
    </footer>
  );
}
