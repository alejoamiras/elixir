import type { DeploymentRecord } from '../../../site/src/config.ts';
import { Chip, shortHash, Tile, TileHeader } from '../../../ui/src/index.ts';
import { W_VK_HASH } from '../../../work-circuit/src/generated/vk.ts';
import { navigate, pathFor } from '../routes';

const record = JSON.parse(import.meta.env.VITE_DEPLOYMENT_RECORD) as DeploymentRecord;

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
        <Chip label="miner" value={shortHash(record.miner)} full={record.miner} />
        <Chip label="token" value={shortHash(record.token)} full={record.token} />
        <Chip label="class" value={shortHash(record.minerClassId)} full={record.minerClassId} />
        <Chip label="W vk" value={shortHash(W_VK_HASH)} full={W_VK_HASH} />
        <Chip label="source" value={commit.slice(0, 7)} full={commit} />
      </div>
      <pre
        className="mt-2.5 overflow-x-auto rounded-sm bg-ground px-2.5 py-2 font-mono text-[11.5px] text-ink-2"
        data-testid="reproduce-command"
      >
        {`AZTEC_NODE_URL=${nodeUrl} bun run epoch:stats`}
      </pre>
    </Tile>
  );
}
