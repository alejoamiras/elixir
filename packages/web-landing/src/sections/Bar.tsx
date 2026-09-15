import { ownVersionName } from '../../../site/src/browser/version-name.ts';
import { Badge, Brand, Button } from '../../../ui/src/index.ts';
import { copy } from '../copy';
import { appHref } from '../state';

/** The landing's own bar: the shared brand, the page's sections, and the two apps at the right. */
export function Bar({ live }: { live: boolean }) {
  return (
    <header className="sticky top-0 z-10 flex h-[52px] items-center gap-5 border-b border-line bg-ground/90 px-5 backdrop-blur">
      <Brand version={ownVersionName()} homeHref="#hero" mark={live ? 'mining' : 'idle'} />
      <nav className="hidden gap-[18px] text-[13px] md:flex" aria-label="sections">
        {copy.bar.anchors.map((a) => (
          <a key={a.id} href={`#${a.id}`} className="py-1 text-ink-2 hover:text-ink">
            {a.label}
          </a>
        ))}
      </nav>
      <span className="ml-auto flex items-center gap-2.5">
        <Badge variant="net">testnet</Badge>
        <a href={appHref('stats')} className="text-[13px] text-ink-2 hover:text-ink" data-testid="bar-stats">
          {copy.bar.stats}
        </a>
        <Button variant="uv" size="sm" className="hidden md:inline-flex" data-testid="bar-mine" asChild>
          <a href={appHref('mine')}>{copy.bar.mine}</a>
        </Button>
      </span>
    </header>
  );
}
