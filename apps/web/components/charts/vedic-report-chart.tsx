'use client';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import type { VedicChart } from '@tianji/shared';
import { VedicSouthChart } from './vedic-south-chart';
import { VedicNorthChart } from './vedic-north-chart';
import { NakshatraCard } from './nakshatra-card';
import { DashaTimeline } from './dasha-timeline';
import type { Division } from './vedic-geometry';
/** D1/D9 responsive comparison with South/North layout, Moon mansion and expandable Dasha. */
export function VedicReportChart({
  chart,
  nowISO,
  highlight,
  onSelect,
}: {
  chart: VedicChart;
  nowISO: string;
  highlight?: string;
  onSelect?: (section: string, path?: string) => void;
}) {
  const t = useTranslations();
  const [division, setDivision] = useState<Division>('D1');
  const [north, setNorth] = useState(false);
  const Chart = north ? VedicNorthChart : VedicSouthChart;
  return (
    <div className="vedic-report-chart">
      {chart.noonChart ? (
        <p className="notice" role="note">
          {t('charts.vedic.noon')}
        </p>
      ) : null}
      <div className="chart-controls">
        <div className="division-controls" role="group" aria-label={t('charts.vedic.division')}>
          {(['D1', 'D9'] as const).map((d) => (
            <button
              type="button"
              className="chart-toggle"
              aria-pressed={division === d}
              onClick={() => setDivision(d)}
              key={d}
            >
              {t(`charts.vedic.${d}`)}
            </button>
          ))}
        </div>
        <label>
          {t('charts.vedic.layout')}
          <select
            aria-label={t('charts.vedic.layout')}
            value={north ? 'north' : 'south'}
            onChange={(e) => setNorth(e.target.value === 'north')}
          >
            <option value="south">{t('charts.vedic.south')}</option>
            <option value="north" disabled={chart.noonChart || !chart.lagna}>
              {t('charts.vedic.north')}
            </option>
          </select>
        </label>
      </div>
      <div className="vedic-divisions">
        {(['D1', 'D9'] as const).map((d) => (
          <figure className={division === d ? 'vedic-division active' : 'vedic-division'} key={d}>
            <figcaption>{t(`charts.vedic.${d}`)}</figcaption>
            <Chart chart={chart} division={d} highlight={highlight} onSelect={onSelect} />
          </figure>
        ))}
      </div>
      {chart.noonChart ? (
        <p>{t('charts.noHouses')}</p>
      ) : (
        <p className="muted">
          {t(north ? 'charts.vedic.northLegend' : 'charts.vedic.southLegend')}
        </p>
      )}
      <NakshatraCard chart={chart} onSelect={onSelect} />
      <DashaTimeline chart={chart} nowISO={nowISO} onSelect={onSelect} />
    </div>
  );
}
