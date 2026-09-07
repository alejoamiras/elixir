import type { ReactNode } from 'react';
import { Tile, TileHeader } from '../../../ui/src/index.ts';
import { type ChartProps, Difficulty, Duration, Emission, Retarget } from '../charts/index.tsx';

function ChartTile({
  title,
  aside,
  className,
  children,
}: {
  title: string;
  aside: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Tile className={className}>
      <TileHeader aside={aside}>{title}</TileHeader>
      {children}
    </Tile>
  );
}

/** The lead chart on its own row, then the three small multiples side by side. */
export function ChartRows(charts: ChartProps) {
  return (
    <>
      <ChartTile
        title="difficulty"
        aside={`per epoch, log scale · ${charts.rows.length} epochs`}
        className="border-line-2 md:col-span-6"
      >
        <Difficulty {...charts} />
      </ChartTile>
      <div className="grid gap-[14px] md:col-span-6 md:grid-cols-3" data-testid="small-multiples">
        <ChartTile title="emission" aside="against the schedule">
          <Emission {...charts} />
        </ChartTile>
        <ChartTile title="epoch duration" aside="amber = the escape hatch">
          <Duration {...charts} />
        </ChartTile>
        <ChartTile title="retarget at each close" aside="violet harder · grey easier">
          <Retarget {...charts} />
        </ChartTile>
      </div>
    </>
  );
}
