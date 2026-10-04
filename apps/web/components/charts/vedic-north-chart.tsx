'use client';
import { useTranslations } from 'next-intl';
import type { VedicChart } from '@tianji/shared';
import { bodyFromEvidence, houseFromEvidence, SIGNS } from './astro-geometry';
import {
  GRAHA_SHORT,
  NORTH_CELLS,
  houseSign,
  vedicDivision,
  type Division,
} from './vedic-geometry';
/** Fixed-house North Indian diamond; house one is upper center and zodiac numbers follow the Lagna. */
export function VedicNorthChart({
  chart,
  division = 'D1',
  highlight,
  onSelect,
}: {
  chart: VedicChart;
  division?: Division;
  highlight?: string;
  onSelect?: (section: string, path?: string) => void;
}) {
  const t = useTranslations();
  const { lagna, bodies } = vedicDivision(chart, division);
  const selected = bodyFromEvidence(bodies, highlight);
  const activeHouse = houseFromEvidence(chart.houses ?? [], highlight);
  // DESIGN-GAP: A fixed-house northern chart cannot be oriented without Lagna; retain the fixed-sign southern chart instead.
  if (!lagna) return <p className="notice">{t('charts.vedic.northNeedsTime')}</p>;
  return (
    <svg
      viewBox="0 0 400 400"
      className="vedic-chart"
      role="group"
      aria-label={t('charts.vedic.northTitle', { division })}
    >
      <title>{t('charts.vedic.northTitle', { division })}</title>
      {NORTH_CELLS.map((cell, index) => {
        const sign = houseSign(lagna, index),
          occupants = bodies.filter((b) => b.sign === sign);
        return (
          <g key={index} data-house={index + 1} data-sign={sign}>
            <polygon
              points={cell.points}
              role="button"
              tabIndex={0}
              aria-label={t('charts.houseNumber', { number: index + 1 })}
              onClick={() =>
                onSelect?.(division === 'D9' ? 'navamsa' : 'houses', `houses.${index}`)
              }
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onSelect?.(division === 'D9' ? 'navamsa' : 'houses', `houses.${index}`);
                }
              }}
              fill={activeHouse === index ? 'var(--surface-2)' : 'var(--surface-1)'}
              stroke="var(--gold)"
              strokeOpacity="0.65"
            />
            <text x={cell.x} y={cell.y} className="vedic-sign">
              <title>{t(`charts.sign.${sign}`)}</title>
              {SIGNS.indexOf(sign) + 1}
            </text>
            {occupants.map((b, i) => (
              <g
                key={b.key}
                role="button"
                tabIndex={0}
                aria-label={`${t(`charts.graha.${b.key}`)} · ${t('charts.houseNumber', { number: index + 1 })} · ${b.degree.toFixed(1)}°`}
                aria-pressed={selected === b.key}
                data-body={b.key}
                className={selected === b.key ? 'chart-selected' : undefined}
                onClick={() =>
                  onSelect?.(
                    division === 'D9' ? 'navamsa' : 'lagna_planets',
                    `bodies.${chart.bodies.findIndex((p) => p.key === b.key)}`,
                  )
                }
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onSelect?.(
                      division === 'D9' ? 'navamsa' : 'lagna_planets',
                      `bodies.${chart.bodies.findIndex((p) => p.key === b.key)}`,
                    );
                  }
                }}
              >
                <rect
                  x={cell.x - 30}
                  y={cell.y + 6 + i * 10}
                  width="60"
                  height="10"
                  fill="transparent"
                />
                <text x={cell.x} y={cell.y + 12 + i * 10} className="vedic-body">
                  {GRAHA_SHORT[b.key]} {b.degree.toFixed(0)}°
                </text>
              </g>
            ))}
          </g>
        );
      })}
    </svg>
  );
}
