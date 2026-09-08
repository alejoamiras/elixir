import { cn } from '../../../ui/src/index.ts';
import { copy, symbol } from '../copy';
import { Section, SectionHeading, SectionLabel } from './Section';

const CELL = 'border-b border-line py-2 pr-2.5';

export function Money() {
  const { heading, lede, table } = copy.money;
  return (
    <Section id="money" className="grid gap-9 px-4 py-8 md:grid-cols-[1fr_1.25fr] md:px-9">
      <div>
        <SectionLabel>money</SectionLabel>
        <SectionHeading>{heading}</SectionHeading>
        <p className="text-pretty text-ink-2" data-testid="money-lede">
          {lede}
        </p>
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
              {['', ...table.columns].map((c) => (
                <th
                  key={c}
                  className={cn(
                    'label-mono border-b border-line pt-2 pb-2.5 pr-2.5 text-left font-medium',
                    c === symbol && 'text-uv-2',
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
                  <td
                    key={cell}
                    className={cn(CELL, i === row.cells.length - 1 ? 'text-uv-2' : 'text-ink-2')}
                  >
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
