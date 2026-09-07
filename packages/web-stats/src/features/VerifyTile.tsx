import type { DeploymentRecord } from '../../../site/src/config.ts';
import { Chip, ExternalLink, shortHash, Tile, TileHeader } from '../../../ui/src/index.ts';
import { W_VK_HASH } from '../../../work-circuit/src/generated/vk.ts';
import { links } from '../explorer';
import { reproduceCommand } from '../lib/reproduce.ts';
import { navigate, pathFor } from '../routes';

const record = JSON.parse(import.meta.env.VITE_DEPLOYMENT_RECORD) as DeploymentRecord;

/** A chip whose value opens the explorer's page (a copy button beside it), styled like `Chip`. */
function LinkChip({
  label,
  value,
  href,
  testId,
}: {
  label: string;
  value: string;
  href?: string;
  testId: string;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-sm border border-line bg-panel px-2 py-1 font-mono text-2xs text-ink-2">
      <span>{label}</span>
      <ExternalLink href={href} full={value} copy className="text-ink" data-testid={testId}>
        {shortHash(value)}
      </ExternalLink>
    </span>
  );
}

/** The deployment's identity as chips, and the one command that reproduces the page; the route has the rest. */
export function VerifyTile({ nodeUrl, className }: { nodeUrl: string; className?: string }) {
  const commit = import.meta.env.VITE_SOURCE_COMMIT;
  return (
    <Tile className={className} data-testid="verify-tile">
      <TileHeader
        aside={
          <a
            href={pathFor('verify')}
            className="hover:text-ink"
            onClick={(e) => {
              e.preventDefault();
              navigate('verify');
            }}
          >
            the full record →
          </a>
        }
      >
        verify
      </TileHeader>
      <div className="flex flex-wrap gap-2">
        <LinkChip
          label="miner"
          value={record.miner}
          href={links.instance(record.miner)}
          testId="chip-miner"
        />
        <LinkChip
          label="token"
          value={record.token}
          href={links.instance(record.token)}
          testId="chip-token"
        />
        <LinkChip
          label="class"
          value={record.minerClassId}
          href={links.classVersion(record.minerClassId)}
          testId="chip-class"
        />
        <Chip label="W vk" value={shortHash(W_VK_HASH)} full={W_VK_HASH} />
        <Chip label="source" value={commit.slice(0, 7)} full={commit} />
      </div>
      <pre
        className="mt-2.5 overflow-x-auto rounded-sm bg-ground px-2.5 py-2 font-mono text-[11.5px] text-ink-2"
        data-testid="reproduce-command"
      >
        {reproduceCommand(nodeUrl)}
      </pre>
    </Tile>
  );
}
