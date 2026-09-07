import { PARAMS } from '../../../miner-core/src/generated/params.ts';
import type { DeploymentRecord } from '../../../site/src/config.ts';
import { Button, Chip, shortHash } from '../../../ui/src/index.ts';
import { W_VK_HASH } from '../../../work-circuit/src/generated/vk.ts';
import { copy, LINKS, REPO } from '../copy';
import { appHref } from '../state';
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
    <Section id="verify" className="grid gap-10 px-4 py-8 md:grid-cols-2 md:px-9">
      <div>
        <SectionLabel>verify</SectionLabel>
        <SectionHeading>{v.heading}</SectionHeading>
        <p className="text-pretty text-ink-2">{v.body}</p>
      </div>
      <div>
        <div className="flex flex-wrap gap-2" data-testid="verify-chips">
          <Chip label="miner" value={shortHash(record.miner)} full={record.miner} />
          <Chip label="token" value={shortHash(record.token)} full={record.token} />
          <Chip label="class" value={shortHash(record.minerClassId)} full={record.minerClassId} />
          <Chip label="W vk" value={shortHash(W_VK_HASH)} full={W_VK_HASH} />
          <Chip label="source" value={commit.slice(0, 7)} full={commit} />
          <Chip label="launched" value={launched} />
          <Chip label="rules" value={`N ${PARAMS.N} · ${PARAMS.EXPECTED_EPOCH_SECONDS} s · ×¼…4`} />
        </div>
        <div className="mt-3.5 flex flex-wrap gap-2.5">
          <Button size="sm" asChild>
            <a href={REPO}>{v.source}</a>
          </Button>
          <Button size="sm" variant="ghost" asChild>
            <a href={LINKS.threatModel}>{v.threatModel}</a>
          </Button>
          <Button size="sm" variant="ghost" asChild>
            <a href={`${appHref('stats')}verify`}>{v.build}</a>
          </Button>
        </div>
      </div>
    </Section>
  );
}
