import { Badge, Button, Mark } from '../../../ui/src/index.ts';
import { copy } from '../copy';
import { appHref } from '../state';

export function Bar({ live }: { live: boolean }) {
  return (
    <header className="sticky top-0 z-10 flex h-[52px] items-center gap-5 border-b border-line bg-ground/90 px-4 backdrop-blur md:px-5">
      <a href="#hero" className="flex items-center gap-2 font-semibold">
        <Mark state={live ? 'mining' : 'idle'} />
        Yacana
      </a>
      <nav className="hidden gap-4 text-sm md:flex" aria-label="sections">
        {copy.bar.anchors.map((a) => (
          <a key={a.id} href={`#${a.id}`} className="py-1 text-ink-2 hover:text-ink">
            {a.label}
          </a>
        ))}
      </nav>
      <span className="ml-auto flex items-center gap-3">
        <Badge variant="warn">testnet</Badge>
        <a href={appHref('stats')} className="text-sm text-ink-2 hover:text-ink">
          {copy.bar.stats}
        </a>
        <Button variant="uv" size="sm" className="hidden md:inline-flex" data-testid="bar-mine" asChild>
          <a href={appHref('mine')}>{copy.bar.mine}</a>
        </Button>
      </span>
    </header>
  );
}
