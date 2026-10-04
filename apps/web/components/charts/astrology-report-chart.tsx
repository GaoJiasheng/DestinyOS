'use client';
import dynamic from 'next/dynamic';
import { useCallback, useEffect, useRef, useState } from 'react';
import { canUseThree, reportThreeFallback } from '@/lib/three-policy';
import { readAnonymous } from '@/lib/anonymous-storage';
import { useTranslations } from 'next-intl';
import type { AstroChart, HouseSystem } from '@tianji/shared';
import { NatalWheel } from './natal-wheel';
import { PlanetTable } from './planet-table';
const NatalWheel3D = dynamic(() => import('../three/natal-wheel-3d'), { ssr: false });
/** Western report controls, SVG fallback, lazy celestial sphere and collapsible positions table. */
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
  const [reducedMotion, setReducedMotion] = useState(false);
  const reported = useRef(false);
  useEffect(() => {
    let live = true;
    let preference = false;
    Promise.all([
      readAnonymous().catch(() => null),
      import('@/app/home/actions')
        .then(({ getMotionPreferenceAction }) => getMotionPreferenceAction())
        .catch(() => false),
    ]).then(([data, account]) => {
      preference = account || data?.settings.reducedMotion === true;
      if (!live) return;
      setReducedMotion(preference);
      document.documentElement.dataset.reducedMotion = String(preference);
      if (preference) {
        setThree(false);
        setFallback(true);
      }
    });
    const media = matchMedia('(prefers-reduced-motion: reduce)');
    const connection = (navigator as Navigator & { connection?: EventTarget }).connection;
    const update = () => {
      if (!canUseThree(preference)) {
        setThree(false);
        setFallback(true);
      }
    };
    media.addEventListener('change', update);
    connection?.addEventListener('change', update);
    return () => {
      live = false;
      media.removeEventListener('change', update);
      connection?.removeEventListener('change', update);
    };
  }, []);
  const onFailure = useCallback(() => {
    setThree(false);
    setFallback(true);
    if (!reported.current) {
      reported.current = true;
      reportThreeFallback('natal', 'render-or-fps');
    }
  }, []);
  const toggle = () => {
    if (three) {
      setThree(false);
      return;
    }
    const unavailable = !canUseThree(reducedMotion);
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
      {three ? (
        <NatalWheel3D
          chart={chart}
          highlight={highlight}
          onSelect={onSelect}
          onFailure={onFailure}
        />
      ) : null}
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
