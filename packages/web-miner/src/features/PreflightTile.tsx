import { Preflight, type PreflightRow, Tile } from '../../../ui/src/index.ts';

/** The preflight's rows while it runs: the cockpit takes over the moment it passes. */
export function PreflightTile({ rows }: { rows: PreflightRow[] }) {
  return (
    <Tile>
      <h2 className="label-mono mb-3">preflight</h2>
      <Preflight rows={rows} />
      <p className="mt-4 text-xs text-ink-2">
        The proving keys (20 MB) download in the background and are checked against their pinned hashes.
        Whoever serves this page controls it: run your own build if that matters.
      </p>
    </Tile>
  );
}
