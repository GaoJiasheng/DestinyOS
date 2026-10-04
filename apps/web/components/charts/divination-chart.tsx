'use client';
import type { IchingChart, QimenChart } from '@tianji/shared';
import { HexagramFigure } from './hexagram-figure';
import { TrigramBodyUse } from './trigram-body-use';
import { LiuyaoTable } from './liuyao-table';
import { QimenGrid } from './qimen-grid';
/** Shared ritual and report chart renderer using immutable engine output. */
export function DivinationChart({
  chart,
  animate = false,
  onSelect,
}: {
  chart: IchingChart | QimenChart;
  animate?: boolean;
  onSelect?: (section: string) => void;
}) {
  if ('palaces' in chart) return <QimenGrid chart={chart} animate={animate} onSelect={onSelect} />;
  return (
    <div data-testid="iching-chart">
      <div className="hexagram-set">
        <HexagramFigure
          hexagram={chart.primary}
          movingLines={chart.movingLines}
          animate={animate}
        />
        {chart.mutual ? (
          <HexagramFigure hexagram={chart.mutual} label="mutual" animate={animate} />
        ) : null}
        {chart.changing ? (
          <div className={animate ? 'hexagram-flip' : ''}>
            <HexagramFigure hexagram={chart.changing} label="changing" animate={animate} />
          </div>
        ) : null}
      </div>
      <TrigramBodyUse chart={chart} />
      <LiuyaoTable chart={chart} />
    </div>
  );
}
