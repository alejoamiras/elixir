// Under the header on the Mine route: Presto's own billboard while it is absent, the miner's row
// while it is present but in the way, nothing while it proves. The row is the node banner's shape.
import { stateFromStatus } from '@alejoamiras/presto-banners';
import type { PrestoStatus } from '@alejoamiras/presto-core';
import { useAtomValue } from 'jotai';
import { createElement, useEffect, useRef } from 'react';
import { Alert, Button, useTheme } from '../../../ui/src/index.ts';
import { noticeFor, prestoAtom } from '../presto';
import { useSettings } from '../settings';
import { bootAtom } from '../state';

const PRESTO_SITE = 'https://presto.build';

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

export function PrestoBanner({ onRetry }: { onRetry: () => void }) {
  const presto = useAtomValue(prestoAtom);
  const boot = useAtomValue(bootAtom);
  const [settings] = useSettings();
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
        <span className="flex items-center gap-3.5 whitespace-nowrap">
          {boot.phase === 'ready' && notice.tone === 'warn' && (
            <span className="font-mono text-2xs tracking-[0.04em] opacity-75">
              browser · {settings.threads ?? boot.threads} threads
            </span>
          )}
          {notice.retry && (
            <Button size="sm" onClick={onRetry} data-testid="presto-retry">
              Retry
            </Button>
          )}
        </span>
      </div>
    </Alert>
  );
}
