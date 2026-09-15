import { Button, Progress, Stepper } from '../../../../ui/src/index.ts';
import { bytesDetail, type OpeningStep, openingIndeterminate, progressOf } from '../../opening-steps';
import { useSettings } from '../../settings';

/** A step as the canvas draws it: done ones in `ok` with a ✓, the keys step's bytes in the right column. */
const shown = (s: OpeningStep): OpeningStep => ({
  ...s,
  label: s.state === 'done' ? <span className="text-ok">✓ {s.label}</span> : s.label,
  detail: undefined,
  right: s.state === 'active' && s.bytes ? bytesDetail(s.bytes) : undefined,
});

/** The opening body: the step list, the bar, and Cancel once the ceremony is over. */
export function Opening({ steps, onCancel }: { steps: OpeningStep[]; onCancel: () => void }) {
  const [settings] = useSettings();
  // The first step done means the ceremony (its OS prompt) is over: Cancel is safe from here.
  const canCancel = steps.find((s) => s.id === 'key')?.state === 'done';
  const footer = settings.resumeOnOpen
    ? 'Mining resumes when it is done.'
    : 'You can watch the chain behind this; press Start when it is done.';
  return (
    <div className="flex flex-col gap-4" data-testid="opening">
      <div>
        <span className="label-mono">opening your account</span>
        <h2 className="mt-1 text-[24px] leading-tight">A minute the first time.</h2>
        <p className="mt-2 text-sm text-ink-2">
          The proving keys are 20 MB, fetched once and kept. After that, opening takes a few seconds.
        </p>
      </div>
      <Progress
        value={progressOf(steps)}
        indeterminate={openingIndeterminate(steps)}
        indeterminateSpan={100}
        data-testid="opening-bar"
      />
      <Stepper steps={steps.map(shown)} />
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs text-ink-3">{footer}</span>
        <Button
          variant="ghost"
          size="sm"
          disabled={!canCancel}
          onClick={onCancel}
          data-testid="opening-cancel"
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}
