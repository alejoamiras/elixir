import { useState } from 'react';
import { Button, Input, Label, Tile, TileHeader } from '../../../ui/src/index.ts';
import { allowedNodeOrigins, type Connection, isPinnedByQuery, saveConnection } from '../config';

const fields: { key: keyof Connection; label: string; placeholder: string }[] = [
  { key: 'nodeUrl', label: 'Node URL', placeholder: 'https://…' },
  {
    key: 'crossCheckUrl',
    label: 'Cross-check node (optional)',
    placeholder: 'a second node to compare epochs',
  },
  { key: 'miner', label: 'Miner contract', placeholder: '0x…' },
  { key: 'token', label: 'Token contract', placeholder: '0x…' },
];

export function ConnectionCard({ connection }: { connection: Connection }) {
  const [draft, setDraft] = useState(connection);
  const pinned = isPinnedByQuery();
  const dirty = JSON.stringify(draft) !== JSON.stringify(connection);
  return (
    <Tile>
      <TileHeader>Network</TileHeader>
      <div className="grid gap-3">
        {fields.map((f) => (
          <div key={f.key} className="grid gap-1">
            <Label htmlFor={f.key}>{f.label}</Label>
            <Input
              id={f.key}
              value={draft[f.key]}
              placeholder={f.placeholder}
              disabled={pinned}
              onChange={(e) => setDraft({ ...draft, [f.key]: e.target.value })}
            />
          </div>
        ))}
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="primary"
            disabled={!dirty || pinned}
            onClick={() => {
              saveConnection(draft);
              location.reload();
            }}
          >
            Save and reload
          </Button>
          {pinned && <span className="text-ink-2 text-xs">set by the page URL</span>}
        </div>
        <p className="text-ink-2 text-xs">
          This build's security policy allows nodes at {allowedNodeOrigins().join(', ')}
          {import.meta.env.DEV ? ' and local nodes' : ''}; other origins need a rebuild.
        </p>
      </div>
    </Tile>
  );
}
