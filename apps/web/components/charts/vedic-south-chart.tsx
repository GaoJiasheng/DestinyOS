'use client';
import { useTranslations } from 'next-intl';
import type { VedicChart } from '@tianji/shared';
import { bodyFromEvidence, houseFromEvidence, SIGNS } from './astro-geometry';
import { SOUTH_CELLS, vedicDivision, type Division } from './vedic-geometry';
/** Fixed-sign South Indian chart with a diagonal Lagna mark and true D1/D9 positions. */
export function VedicSouthChart({
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
  // DESIGN-GAP: Compact graha labels use Chinese planetary abbreviations in zh and conventional Latin abbreviations in en via next-intl.
  const t = useTranslations();
  const { lagna, bodies } = vedicDivision(chart, division);
  const selected = bodyFromEvidence(bodies, highlight);
  const activeHouse = houseFromEvidence(chart.houses ?? [], highlight);
  return (
    <svg
      viewBox="0 0 400 400"
      className="vedic-chart"
      role="group"
      aria-label={t('charts.vedic.southTitle', { division })}
    >
      <title>{t('charts.vedic.southTitle', { division })}</title>
      {SIGNS.map((sign, index) => {
        const [col, row] = SOUTH_CELLS[index]!,
          x = col * 100,
          y = row * 100;
        const occupants = bodies.filter((b) => b.sign === sign);
        const houseIndex = lagna ? (index - SIGNS.indexOf(lagna) + 12) % 12 : null;
        const cellPath = houseIndex !== null ? `houses.${houseIndex}` : `sign.${sign}`;
        const cellSection = division === 'D9' ? 'navamsa' : lagna ? 'houses' : 'lagna_planets';
        return (
          <g key={sign} data-sign={sign}>
            <rect
              x={x + 1}
              y={y + 1}
              width="98"
              height="98"
              role="button"
              tabIndex={0}
              aria-label={t(`charts.sign.${sign}`)}
              onClick={() => onSelect?.(cellSection, cellPath)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onSelect?.(cellSection, cellPath);
                }
              }}
              fill={
                activeHouse === houseIndex || highlight === cellPath
                  ? 'var(--surface-2)'
                  : 'var(--surface-1)'
              }
              stroke="var(--gold)"
              strokeOpacity="0.65"
            />
            {lagna === sign ? (
              <path
                data-lagna={sign}
                d={`M ${x + 1} ${y + 28} L ${x + 28} ${y + 1}`}
                stroke="var(--accent)"
                strokeWidth="3"
              />
            ) : null}
            <text x={x + 50} y={y + 14} className="vedic-sign">
              {t(`charts.sign.${sign}`)}
            </text>
            {occupants.map((b, i) => (
              <g
                key={b.key}
                role="button"
                tabIndex={0}
                aria-label={`${t(`charts.graha.${b.key}`)} · ${t(`charts.sign.${sign}`)} · ${b.degree.toFixed(1)}°`}
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
                  x={x + 3 + (i % 2) * 48}
                  y={y + 21 + Math.floor(i / 2) * 15}
                  width="47"
                  height="15"
                  fill="transparent"
                />
                <text
                  x={x + 26 + (i % 2) * 48}
                  y={y + 29 + Math.floor(i / 2) * 15}
                  className="vedic-body"
                >
                  {t(`charts.grahaShort.${b.key}`)} {b.degree.toFixed(0)}°
                </text>
              </g>
            ))}
          </g>
        );
      })}
      <text x="200" y="179" className="vedic-center">
        {t(`charts.vedic.${division}`)}
      </text>
      <text x="200" y="209" className="vedic-center-small">
        {t(lagna ? 'charts.vedic.lagna' : 'charts.noonLabel')}
        {lagna ? ` · ${t(`charts.sign.${lagna}`)}` : ''}
      </text>
      <text x="200" y="234" className="vedic-center-small">
        {t('charts.vedic.lahiri')}
      </text>
    </svg>
  );
}
