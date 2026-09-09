import { Button } from './button.tsx';

/**
 * The way out of a node that does not answer: back to the build's default node, or the miner's
 * Node settings. Rendered under a boot error and on the node banner; the callbacks are the app's.
 */
export function NodeWayOut({
  onDefault,
  settingsHref,
  className,
}: {
  /** Restores the default node and reloads; absent when the default is already in use. */
  onDefault?: () => void;
  /** The miner's settings route, where another node can be checked and used. */
  settingsHref?: string;
  className?: string;
}) {
  if (!onDefault && !settingsHref) return null;
  return (
    <span data-slot="node-way-out" className={`flex flex-wrap items-center gap-3 ${className ?? ''}`}>
      {onDefault && (
        <Button size="sm" onClick={onDefault} data-testid="use-default-node">
          Use the default node
        </Button>
      )}
      {settingsHref && (
        <a
          href={settingsHref}
          className="text-xs underline underline-offset-3 hover:text-ink"
          data-testid="node-settings-link"
        >
          Use another node →
        </a>
      )}
    </span>
  );
}
