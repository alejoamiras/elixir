// Under the header on the Mine route: Presto's own billboard while it is absent, the miner's row
// while it is present but in the way, nothing while it proves. The row is the node banner's shape.
import { stateFromStatus } from '@alejoamiras/presto-banners';
import type { PrestoStatus } from '@alejoamiras/presto-core';
import { Alert, Button, useTheme } from '@yacana/ui';
import { useAtomValue } from 'jotai';
import { createElement, useEffect, useRef } from 'react';
import { noticeFor, PRESTO_SITE, prestoAtom } from '../presto';

type BannerElement = HTMLElement & { status: PrestoStatus };

/** Presto's own billboard: its script loads only here, no fonts request, `status` set once the element is defined. */
function Billboard({ status }: { status: PrestoStatus }) {
  const ref = useRef<BannerElement>(null);
  const { theme } = useTheme();
  useEffect(() => {
    let live = true;
    void import('@alejoamiras/presto-banners/register')
      .then(() => customElements.whenDefined('presto-banner'))
      .then(() => {
        if (live && ref.current) ref.current.status = status;
      });
    return () => {
      live = false;
    };
  }, [status]);
  return createElement('presto-banner', {
    ref,
    variant: 'billboard',
    fonts: 'none',
    theme: theme === 'system' ? 'auto' : theme,
    href: PRESTO_SITE,
    'persist-key': 'yacana.presto',
    'data-testid': 'presto-billboard',
  });
}

/** One sentence on why Presto stepped aside and Retry where it helps; no thread count (the epoch tile's power row has it). */
export function PrestoBanner({ onRetry }: { onRetry: () => void }) {
  const presto = useAtomValue(prestoAtom);
  const notice = noticeFor(presto);
  // The banners' own mapping: under HTTPS-only an uninstalled Presto is "secure connection unconfirmed".
  if (!notice && presto.status && stateFromStatus(presto.status) === 'offline')
    return <Billboard status={presto.status} />;
  if (!notice) return null;
  return (
    <Alert
      variant={notice.tone === 'info' ? 'uv' : 'warn'}
      data-testid="presto-notice"
      data-tone={notice.tone}
    >
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <span className="flex items-center gap-2.5">
          <i aria-hidden className="size-1.5 shrink-0 rounded-full bg-current" />
          <span>{notice.text}</span>
        </span>
        {notice.retry && (
          <Button size="sm" onClick={onRetry} data-testid="presto-retry">
            Retry
          </Button>
        )}
      </div>
    </Alert>
  );
}
