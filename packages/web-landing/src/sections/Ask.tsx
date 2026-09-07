import { Button } from '../../../ui/src/index.ts';
import { copy } from '../copy';
import { useMobile } from '../hooks';
import { appHref } from '../state';
import { Section } from './Section';

export function Ask() {
  const mobile = useMobile();
  return (
    <Section id="ask" className="flex flex-col items-center gap-3.5 px-4 py-11 text-center md:px-9">
      <h2 className="text-balance text-[36px] font-semibold leading-[1.02] tracking-[-0.03em]">
        {copy.ask.heading}
      </h2>
      <div className="flex flex-wrap justify-center gap-2.5">
        {!mobile && (
          <Button variant="uv" size="lg" asChild>
            <a href={appHref('mine')}>{copy.bar.mine}</a>
          </Button>
        )}
        <Button size="lg" asChild>
          <a href={appHref('stats')}>{copy.ask.watch}</a>
        </Button>
      </div>
    </Section>
  );
}

export function Footer() {
  const f = copy.footer;
  return (
    <footer className="flex flex-wrap items-center gap-x-[22px] gap-y-2 border-t border-line px-4 py-[18px] text-xs text-ink-3 md:px-5">
      <p data-testid="footer-line">© Yacana · {f.line}</p>
      <nav className="ml-auto flex flex-wrap gap-x-[22px]" aria-label="footer">
        {f.links.map((l) => (
          <a key={l.label} href={l.href === 'stats' ? appHref('stats') : l.href} className="hover:text-ink">
            {l.label}
          </a>
        ))}
      </nav>
    </footer>
  );
}
