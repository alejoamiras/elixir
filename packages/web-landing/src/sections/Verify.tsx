import { useState } from 'react';
import { PARAMS } from '../../../miner-core/src/generated/params.ts';
import type { DeploymentRecord } from '../../../site/src/config.ts';
import { Button, shortHash } from '../../../ui/src/index.ts';
import { W_VK_HASH } from '../../../work-circuit/src/generated/vk.ts';
import { copy, LINKS, REPO } from '../copy';
import { appHref } from '../state';
import { Section } from './Section';

const record = JSON.parse(import.meta.env.VITE_DEPLOYMENT_RECORD) as DeploymentRecord & {
  launchedAt?: string;
};

const launched = record.launchedAt
  ? `${new Date(Number(record.launchedAt) * 1000).toISOString().slice(0, 16).replace('T', ' ')} UTC`
  : '—';

/** A value of the record; the click copies the whole of it. */
function Chip({ k, v, full }: { k: string; v: string; full?: string }) {
  const [copied, setCopied] = useState(false);
  const text = full ?? v;
  return (
    <button
      type="button"
      className="inline-flex items-center gap-1.5 rounded-sm border border-line bg-panel px-2 py-1 font-mono text-2xs text-ink-2 hover:text-ink"
      onClick={async () => {
        await navigator.clipboard.writeText(text).catch(() => {});
        setCopied(true);
        setTimeout(() => setCopied(false), 1200);
      }}
      data-testid={`chip-${k.replace(/\s+/g, '-')}`}
      title={text}
    >
      <span>{k}</span> <span className="text-ink">{copied ? 'copied' : v}</span>
    </button>
  );
}

export function Verify() {
  const v = copy.verify;
  const commit = import.meta.env.VITE_SOURCE_COMMIT;
  return (
    <Section id="verify" eyebrow="verify" heading={v.heading}>
      <p className="max-w-3xl text-pretty text-ink-2">{v.body}</p>
      <div className="flex flex-wrap gap-2" data-testid="verify-chips">
        <Chip k="miner" v={shortHash(record.miner)} full={record.miner} />
        <Chip k="token" v={shortHash(record.token)} full={record.token} />
        <Chip k="class" v={shortHash(record.minerClassId)} full={record.minerClassId} />
        <Chip k="W vk" v={shortHash(W_VK_HASH)} full={W_VK_HASH} />
        <Chip k="source" v={commit.slice(0, 7)} full={commit} />
        <Chip k="launched" v={launched} />
        <Chip k="rules" v={`N ${PARAMS.N} · ${PARAMS.EXPECTED_EPOCH_SECONDS} s · ×¼…4`} />
      </div>
      <div className="flex flex-wrap gap-3">
        <Button asChild>
          <a href={REPO}>{v.source}</a>
        </Button>
        <Button asChild>
          <a href={LINKS.threatModel}>{v.threatModel}</a>
        </Button>
        <Button asChild>
          <a href={`${appHref('stats')}#verify`}>{v.build}</a>
        </Button>
      </div>
    </Section>
  );
}
