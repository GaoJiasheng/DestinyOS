'use client';
import { useCopy } from '@/i18n/use-copy';
import { ELEMENTS, isHighlighted, type BaziChartProps } from './bazi-shared';

/** Five SVG arcs use the snapshot percentages, with textual percentages for non-color readers. */
export function ElementRing({ chart, highlight, onSelect }: BaziChartProps) {
  const t = useCopy();
  let offset = 0;
  const total = ELEMENTS.reduce((sum, element) => sum + chart.elements.pct[element], 0);
  return (
    <section className="bazi-component" data-chart-path="elements" tabIndex={-1}>
      <h3>{t('bazi.chart.elements')}</h3>
      <svg
        viewBox="0 0 240 240"
        className="bazi-ring"
        role="img"
        aria-label={t('bazi.chart.elements')}
      >
        <circle cx={120} cy={120} r={88} fill="none" stroke="var(--line-2)" strokeWidth={18} />
        {ELEMENTS.map((element) => {
          const pct = chart.elements.pct[element];
          // DESIGN-GAP: Normalize rounded engine percentages only for arc geometry; labels preserve the snapshot values.
          const length = total > 0 ? (pct / total) * 100 : 0;
          const start = offset;
          offset += length;
          return (
            <circle
              key={element}
              cx={120}
              cy={120}
              r={88}
              pathLength={100}
              fill="none"
              stroke={`var(--wu-${element})`}
              strokeWidth={isHighlighted(highlight, `elements.pct.${element}`) ? 24 : 18}
              strokeDasharray={`${length} ${100 - length}`}
              strokeDashoffset={-start}
              transform="rotate(-90 120 120)"
              data-element={element}
              data-pct={pct}
            >
              <title>
                {t('bazi.chart.elementValue', {
                  element: t(`bazi.elements.${element}`),
                  pct: pct.toFixed(1),
                })}
              </title>
            </circle>
          );
        })}
        <text x={120} y={105} textAnchor="middle" className="bazi-ring-caption">
          {t('bazi.tenGods.day_master')}
        </text>
        <text
          x={120}
          y={144}
          textAnchor="middle"
          className="bazi-ring-master"
          fill={`var(--wu-${chart.dayMaster.element})`}
        >
          {t(`bazi.stems.${chart.dayMaster.stem}`)}
        </text>
      </svg>
      <ul className="bazi-element-legend">
        {ELEMENTS.map((element) => (
          <li key={element}>
            <button
              type="button"
              data-chart-path={`elements.pct.${element}`}
              aria-pressed={isHighlighted(highlight, `elements.pct.${element}`)}
              onClick={() => onSelect?.(`elements.pct.${element}`)}
            >
              <span
                className="bazi-dot"
                style={{ background: `var(--wu-${element})` }}
                aria-hidden="true"
              />
              {t('bazi.chart.elementValue', {
                element: t(`bazi.elements.${element}`),
                pct: chart.elements.pct[element].toFixed(1),
              })}
            </button>
          </li>
        ))}
      </ul>
      <p
        data-chart-path="useGod.favorable"
        tabIndex={-1}
        className={isHighlighted(highlight, 'useGod.favorable') ? 'chart-highlight' : undefined}
      >
        {t('bazi.chart.favorable', {
          elements: chart.useGod.favorable.map((e) => t(`bazi.elements.${e}`)).join(' · '),
        })}
      </p>
      <p
        data-chart-path="useGod.unfavorable"
        tabIndex={-1}
        className={isHighlighted(highlight, 'useGod.unfavorable') ? 'chart-highlight' : undefined}
      >
        {t('bazi.chart.unfavorable', {
          elements: chart.useGod.unfavorable.map((e) => t(`bazi.elements.${e}`)).join(' · '),
        })}
      </p>
    </section>
  );
}
