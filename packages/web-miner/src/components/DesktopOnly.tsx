import { useState } from 'react';
import { Button, Mark } from '../../../ui/src/index.ts';

/** The whole miner on a phone is this one screen; the stats work anywhere. */
export function DesktopOnly() {
  const [copied, setCopied] = useState(false);
  const copy = () =>
    navigator.clipboard
      ?.writeText(location.href)
      .then(() => setCopied(true))
      .catch(() => setCopied(false));
  return (
    <main data-testid="desktop-only" className="mx-auto flex max-w-md flex-col gap-5 p-6 pt-16">
      <Mark state="idle" size={28} />
      <h1 className="text-2xl">Yacana mines from a desktop browser.</h1>
      <p className="text-ink-2">
        The prover needs more memory than a phone browser can give it. Open this link on a computer; the stats
        work anywhere.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button variant="primary" onClick={copy}>
          {copied ? 'Link copied' : 'Copy the link'}
        </Button>
        <Button asChild>
          <a href="/stats">Watch the stats</a>
        </Button>
      </div>
    </main>
  );
}
