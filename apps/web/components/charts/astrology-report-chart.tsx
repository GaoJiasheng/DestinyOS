'use client';
import dynamic from 'next/dynamic';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import type { AstroChart, HouseSystem } from '@tianji/shared';
import { NatalWheel } from './natal-wheel';
import { PlanetTable } from './planet-table';
const NatalSphereShell = dynamic(() => import('../three/natal-sphere-shell'), { ssr: false });
/** Western report controls, SVG fallback, lazy 3D shell and collapsible positions table. */
export function AstrologyReportChart({
  chart,
  highlight,
  onSelect,
  onHouseSystem,
  busy = false,
}: {
  chart: AstroChart;
  highlight?: string;
  onSelect?: (section: string, path?: string) => void;
  onHouseSystem?: (system: HouseSystem) => void;
  busy?: boolean;
}) {
  const t = useTranslations();
  const [three, setThree] = useState(false);
  const [fallback, setFallback] = useState(false);
  const toggle = () => {
    if (three) {
      setThree(false);
      return;
    }
    const capabilities = navigator as Navigator & {
      deviceMemory?: number;
      connection?: { saveData?: boolean };
    };
    const canvas = document.createElement('canvas');
    const unavailable =
      window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
      (capabilities.deviceMemory !== undefined && capabilities.deviceMemory < 4) ||
      capabilities.connection?.saveData ||
      !canvas.getContext('webgl2');
    setFallback(Boolean(unavailable));
    setThree(!unavailable);
  };
  return (
    <div className="astrology-report-chart" aria-busy={busy}>
      {chart.noonChart ? (
        <p className="notice" role="note">
          {t('charts.natal.noon')}
        </p>
      ) : null}
      <div className="chart-controls">
        <label>
          {t('form.birth.houseSystem')}
          <select
            aria-label={t('form.birth.houseSystem')}
            value={chart.houseSystem}
            disabled={chart.noonChart || !chart.houses || !onHouseSystem || busy}
            onChange={(e) => {
              const value = e.target.value;
              if (value === 'placidus' || value === 'whole_sign' || value === 'equal')
                onHouseSystem?.(value);
            }}
          >
            {(['placidus', 'whole_sign', 'equal'] as const).map((system) => (
              <option value={system} key={system}>
                {t(`form.birth.house.${system}`)}
              </option>
            ))}
          </select>
        </label>
        <button type="button" className="chart-toggle" aria-pressed={three} onClick={toggle}>
          {t('charts.natal.three')}
        </button>
      </div>
      {busy ? <p role="status">{t('charts.natal.recalculating')}</p> : null}
      {three ? <NatalSphereShell /> : null}
      {fallback ? (
        <p role="status" className="notice">
          {t('charts.natal.threeFallback')}
        </p>
      ) : null}
      <NatalWheel chart={chart} highlight={highlight} onSelect={onSelect} />
      <details>
        <summary>{t('charts.planets')}</summary>
        <PlanetTable chart={chart} highlight={highlight} onSelect={onSelect} />
      </details>
      {chart.noonChart ? <p>{t('charts.noHouses')}</p> : null}
    </div>
  );
}
