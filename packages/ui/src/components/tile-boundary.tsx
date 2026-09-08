import * as React from 'react';
import { Alert, AlertDescription } from './alert.tsx';
import { Button } from './button.tsx';

/** Errors can embed a node's whole response; the log keeps the head of the message, never the UI. */
const MESSAGE_MAX = 300;

/**
 * One tile's failure stays one tile's: a throw while rendering (or in a child's effect) shows a
 * fixed sentence and a way to remount, while its neighbours keep working. The error goes to
 * `onError` (or the console), never to the page. Only rendering is caught: a throw inside an
 * animation frame or a promise is the drawing's own to handle.
 */
export class TileBoundary extends React.Component<
  { name: string; onError?: (message: string) => void; className?: string; children: React.ReactNode },
  { failed: boolean; attempt: number }
> {
  state = { failed: false, attempt: 0 };

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }

  componentDidCatch(error: unknown): void {
    const message = `${this.props.name}: ${error instanceof Error ? error.message : String(error)}`.slice(
      0,
      MESSAGE_MAX,
    );
    if (this.props.onError) this.props.onError(message);
    else console.error(message);
  }

  render(): React.ReactNode {
    if (!this.state.failed)
      return <React.Fragment key={this.state.attempt}>{this.props.children}</React.Fragment>;
    return (
      <Alert
        variant="bad"
        className={this.props.className}
        data-slot="tile-boundary"
        data-tile={this.props.name}
      >
        <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
          <span>This tile hit an error. Try again, or reload the page.</span>
          <Button
            size="sm"
            variant="danger"
            onClick={() => this.setState((s) => ({ failed: false, attempt: s.attempt + 1 }))}
            data-testid="tile-retry"
          >
            Try again
          </Button>
        </AlertDescription>
      </Alert>
    );
  }
}
