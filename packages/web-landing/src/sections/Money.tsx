import { cn } from '../../../ui/src/index.ts';
import { copy, symbol } from '../copy';
import { Section, SectionHeading, SectionLabel } from './Section';

const TONE: Record<string, string> = { green: 'text-ok', amber: 'text-warn', red: 'text-bad' };
const CELL = 'border-b border-line py-2 pr-2.5';

export function Money() {
  const { heading, rules, table } = copy.money;
  return (
    <Section id="money" className="grid gap-9 px-4 py-8 md:grid-cols-[1fr_1.25fr] md:px-9">
      <div>
        <SectionLabel>money</SectionLabel>
        <SectionHeading>{heading}</SectionHeading>
        <dl data-testid="money-rules">
          {rules.map((r) => (
            <div
              key={r.k}
              className="grid grid-cols-[118px_1fr] gap-3 border-t border-line py-2 text-sm first:border-t-0"
            >
              <dt className="font-mono text-2xs leading-[1.6] tracking-[0.1em] text-ink-3 uppercase">
                {r.k}
              </dt>
              <dd>{r.v}</dd>
            </div>
          ))}
        </dl>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full table-fixed border-collapse text-xs md:h-full" data-testid="money-table">
          <colgroup>
            <col style={{ width: '25.6%' }} />
            <col style={{ width: '23.2%' }} />
            <col style={{ width: '23.2%' }} />
            <col style={{ width: '28%' }} />
          </colgroup>
          <thead>
            <tr>
              {['as money', ...table.columns].map((c) => (
                <th
                  key={c}
                  className={cn(
                    'label-mono border-b border-line pt-2 pb-2.5 pr-2.5 text-left font-medium',
                    c === symbol && 'normal-case',
                  )}
                >
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {table.rows.map((row) => (
              <tr key={row.k} className="align-top">
                <td className={cn(CELL, 'text-ink-2')}>{row.k}</td>
                {row.cells.map((cell, i) => (
                  <td key={cell} className={cn(CELL, TONE[row.tone[i] as string])}>
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Section>
  );
}
