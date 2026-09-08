import type { DeploymentRecord } from '../../../site/src/config.ts';
import { Button, Chip, ChipLink, shortHash } from '../../../ui/src/index.ts';
import { W_VK_HASH } from '../../../work-circuit/src/generated/vk.ts';
import { commitUrl, copy, REPO } from '../copy';
import { links } from '../explorer';
import { Section, SectionHeading, SectionLabel } from './Section';

const record = JSON.parse(import.meta.env.VITE_DEPLOYMENT_RECORD) as DeploymentRecord & {
  launchedAt?: string;
};

const launched = record.launchedAt
  ? `${new Date(Number(record.launchedAt) * 1000).toISOString().slice(0, 16).replace('T', ' ')} UTC`
  : '—';

export function Verify() {
  const v = copy.verify;
  const commit = import.meta.env.VITE_SOURCE_COMMIT;
  return (
    <Section id="verify" className="grid gap-10 px-4 py-8 md:grid-cols-[1fr_1.25fr] md:px-9">
      <div>
        <SectionLabel>verify</SectionLabel>
        <SectionHeading>{v.heading}</SectionHeading>
        <p className="text-pretty text-ink-2">{v.body}</p>
      </div>
      <div>
        <div className="flex flex-wrap gap-2" data-testid="verify-chips">
          <ChipLink
            label="miner"
            value={record.miner}
            href={links.instance(record.miner)}
            testId="chip-miner"
          />
          <ChipLink
            label="token"
            value={record.token}
            href={links.instance(record.token)}
            testId="chip-token"
          />
          <ChipLink
            label="class"
            value={record.minerClassId}
            href={links.classVersion(record.minerClassId)}
            testId="chip-class"
          />
          <Chip label="W vk" value={shortHash(W_VK_HASH)} full={W_VK_HASH} />
          <ChipLink
            label="source"
            value={commit}
            href={/^[0-9a-f]{40}$/.test(commit) ? commitUrl(commit) : undefined}
            short={(c) => c.slice(0, 7)}
            testId="chip-source"
          />
          <Chip label="launched" value={launched} />
        </div>
        <div className="mt-3.5">
          <Button size="sm" asChild>
            <a href={REPO} data-testid="verify-source">
              {v.source}
            </a>
          </Button>
        </div>
      </div>
    </Section>
  );
}
