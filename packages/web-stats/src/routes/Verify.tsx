// The deployment record in full, against what the node says: addresses, class ids, the work
// circuit's verifier key hash, the source commit, the launch record and the reproduce commands.
import { useAtomValue } from 'jotai';
import { PARAMS } from '../../../miner-core/src/generated/params.ts';
import type { DeploymentRecord } from '../../../site/src/config.ts';
import { ExternalLink, KvRow, Tile, TileHeader } from '../../../ui/src/index.ts';
import { W_VK_HASH } from '../../../work-circuit/src/generated/vk.ts';
import { links } from '../explorer';
import { reproduceCommand } from '../lib/reproduce.ts';
import { fixedAtom, historyAtom, rowsAtom } from '../state';

const record = JSON.parse(import.meta.env.VITE_DEPLOYMENT_RECORD) as DeploymentRecord & {
  profile?: string;
  nodeUrl?: string;
  deployer?: string;
  minerSalt?: string;
  tokenSalt?: string;
  launchAt?: string;
  launchedAt?: string;
  deployedAt?: string;
  params?: Record<string, string | number>;
};

/** A value in full; with `href`, the explorer's page for it one click away (the code stays the exact text). */
const Hex = ({ value, testId, href }: { value: string; testId?: string; href?: string }) => {
  const code = (
    <code className="break-all font-mono text-xs" data-testid={testId}>
      {value}
    </code>
  );
  return href ? (
    <ExternalLink href={href} full={value} className="text-ink">
      {code}
    </ExternalLink>
  ) : (
    code
  );
};

const stamp = (unix?: string) => (unix ? `${new Date(Number(unix) * 1000).toISOString()} (${unix})` : '—');

export function Verify({ nodeUrl }: { nodeUrl: string }) {
  const fixed = useAtomValue(fixedAtom);
  const history = useAtomValue(historyAtom);
  const rows = useAtomValue(rowsAtom);
  const first = rows?.[0];
  const commit = import.meta.env.VITE_SOURCE_COMMIT;
  return (
    <div className="grid gap-4 md:grid-cols-2" data-testid="verify">
      <Tile className="md:col-span-2">
        <TileHeader>the deployment this page was built for</TileHeader>
        <KvRow label="profile" value={record.profile ?? import.meta.env.VITE_SITE_MODE} />
        <KvRow label="chain id · rollup version" value={`${record.chainId} · ${record.rollupVersion}`} />
        <KvRow
          label="miner"
          value={<Hex value={record.miner} testId="verify-miner" href={links.instance(record.miner)} />}
        />
        <KvRow
          label="miner class id"
          value={
            <Hex
              value={record.minerClassId}
              testId="verify-miner-class"
              href={links.classVersion(record.minerClassId)}
            />
          }
        />
        <KvRow
          label="token"
          value={<Hex value={record.token} testId="verify-token" href={links.instance(record.token)} />}
        />
        <KvRow
          label="token class id"
          value={
            <Hex
              value={record.tokenClassId}
              testId="verify-token-class"
              href={links.classVersion(record.tokenClassId)}
            />
          }
        />
        <KvRow
          label="deployer (no privilege after bind_token)"
          value={
            <Hex value={record.deployer ?? '—'} href={record.deployer && links.address(record.deployer)} />
          }
        />
        <KvRow
          label="miner salt · token salt"
          value={<Hex value={`${record.minerSalt ?? '—'} · ${record.tokenSalt ?? '—'}`} />}
        />
        <KvRow label="work circuit verifier key hash" value={<Hex value={W_VK_HASH} testId="verify-vk" />} />
        <KvRow label="source commit" value={<Hex value={commit} testId="verify-commit" />} />
        <KvRow
          label="deployed · launch at"
          value={`${record.deployedAt ?? '—'} · ${stamp(record.launchAt)}`}
        />
      </Tile>
      <Tile>
        <TileHeader>the launch, as public storage records it</TileHeader>
        {fixed ? (
          <>
            <KvRow
              label="genesis target"
              value={<Hex value={`0x${fixed.genesis.target.toString(16)}`} testId="verify-genesis-target" />}
            />
            <KvRow label="genesis seed" value={<Hex value={`0x${fixed.genesis.seed.toString(16)}`} />} />
            <KvRow label="launch at" value={stamp(String(fixed.genesis.launchAt))} />
            <KvRow
              label="lottery mix · reveals"
              value={
                history?.lottery
                  ? `${history.lottery.mix.toString(16).slice(0, 12)}… · ${history.lottery.reveals}`
                  : '—'
              }
            />
            <KvRow
              label="epoch 0 opened"
              value={stamp(String(first?.epoch === 0 ? first.openedAt : record.launchedAt))}
            />
            <KvRow label="open epoch" value={String(fixed.open)} />
          </>
        ) : (
          <p className="text-xs text-ink-2">reading…</p>
        )}
      </Tile>
      <Tile>
        <TileHeader>the constants this build assumes</TileHeader>
        {Object.entries(PARAMS)
          .filter(([k]) => !['TOKEN_NAME'].includes(k))
          .map(([k, v]) => (
            <KvRow key={k} label={k} value={<span className="font-mono text-xs">{String(v)}</span>} />
          ))}
      </Tile>
      <Tile className="md:col-span-2">
        <TileHeader>reproduce</TileHeader>
        <p className="mb-2 text-xs text-ink-2">
          Every number on the stats page comes from public storage on the node you choose; the same reads from
          a terminal:
        </p>
        <pre
          className="overflow-x-auto rounded-sm border border-line bg-raised p-3 font-mono text-xs"
          data-testid="reproduce"
        >
          {`${reproduceCommand(nodeUrl)}\n# the artifacts and the verifier key: git checkout ${commit.slice(0, 12)} && bun run codegen && bun run contracts:compile`}
        </pre>
      </Tile>
    </div>
  );
}
