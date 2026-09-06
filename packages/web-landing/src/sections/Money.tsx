import { cn } from '../../../ui/src/index.ts';
import { copy } from '../copy';
import { Section } from './Section';

const TONE: Record<string, string> = { green: 'text-ok', amber: 'text-warn', red: 'text-bad' };

export function Money() {
  const { heading, rules, table } = copy.money;
  return (
    <Section id="money" eyebrow="money" heading={heading}>
      <div className="grid gap-8 md:grid-cols-2">
        <dl className="flex flex-col gap-3" data-testid="money-rules">
          {rules.map((r) => (
            <div key={r.k} className="grid grid-cols-[6rem_1fr] gap-3 border-b border-line pb-3 text-sm">
              <dt className="font-mono text-2xs text-ink-2 uppercase">{r.k}</dt>
              <dd className="text-ink">{r.v}</dd>
            </div>
          ))}
        </dl>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm" data-testid="money-table">
            <thead>
              <tr className="text-left font-mono text-2xs text-ink-2 uppercase">
                <th className="py-2 pr-3 font-normal">as money</th>
                {table.columns.map((c) => (
                  <th key={c} className="py-2 pr-3 font-normal">
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {table.rows.map((row) => (
                <tr key={row.k} className="border-t border-line align-top">
                  <td className="py-2 pr-3 text-ink-2">{row.k}</td>
                  {row.cells.map((cell, i) => (
                    <td key={cell} className={cn('py-2 pr-3', TONE[row.tone[i] as string])}>
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Section>
  );
}
