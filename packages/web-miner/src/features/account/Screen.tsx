// The account dialog's frame: an eyebrow, a title, one body line, then what the screen holds.
import type * as React from 'react';
import { Button, cn } from '../../../../ui/src/index.ts';

export function Screen({
  eyebrow,
  title,
  body,
  onBack,
  children,
  ...props
}: React.ComponentProps<'div'> & {
  eyebrow: React.ReactNode;
  title: React.ReactNode;
  body?: React.ReactNode;
  onBack?: () => void;
}) {
  return (
    <div className="flex flex-col gap-4" data-testid="key-screen" {...props}>
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 self-start text-[13px] text-ink-3 hover:text-ink"
          data-testid="back"
        >
          <svg viewBox="0 0 16 16" width={12} height={12} aria-hidden>
            <path
              d="M10 3 5 8l5 5"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.6}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          Back
        </button>
      )}
      <div className="flex flex-col gap-2">
        <span className="font-mono text-[11.5px] font-medium uppercase leading-none tracking-[0.14em] text-uv-2">
          {eyebrow}
        </span>
        <h2 className="text-[22px] leading-[1.2] font-semibold tracking-[-0.02em] text-ink">{title}</h2>
        {body && <p className="text-sm leading-[1.5] text-ink-2 [text-wrap:pretty]">{body}</p>}
      </div>
      {children}
    </div>
  );
}

export function Primary({ className, variant = 'uv', ...props }: React.ComponentProps<typeof Button>) {
  return (
    <Button
      variant={variant}
      size="lg"
      className={cn('h-[46px] w-full px-[22px] text-[15px]', className)}
      {...props}
    />
  );
}

export function Quiet({ className, ...props }: React.ComponentProps<'button'>) {
  return (
    <button
      type="button"
      className={cn(
        'text-[13px] text-ink-2 underline decoration-ink-4 underline-offset-3 hover:text-ink disabled:opacity-50',
        className,
      )}
      {...props}
    />
  );
}

export function QuietRow({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-wrap gap-x-[18px] gap-y-2">{children}</div>;
}

export const Consent = ({
  checked,
  onChange,
  children,
  testId,
}: {
  checked: boolean;
  onChange: (on: boolean) => void;
  children: React.ReactNode;
  testId: string;
}) => (
  <label className="flex items-start gap-2.5 text-[13px] leading-[1.45] text-ink-2">
    <input
      type="checkbox"
      checked={checked}
      onChange={(e) => onChange(e.target.checked)}
      className="mt-0.5 size-4 shrink-0 accent-uv"
      data-testid={testId}
    />
    <span>{children}</span>
  </label>
);
