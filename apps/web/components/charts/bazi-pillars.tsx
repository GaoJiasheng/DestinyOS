'use client';
import { useCopy } from '@/i18n/use-copy';
import { PILLAR_KEYS, isHighlighted, highlightedPillars, type BaziChartProps } from './bazi-shared';

/** Four element-colored pillars rise at 80ms intervals; an unknown hour stays explicitly unknown. */
export function BaziPillars({ chart, highlight, onSelect }: BaziChartProps) {
  const t = useCopy();
  return (
    <section className="bazi-component" data-chart-path="pillars" tabIndex={-1}>
      <h3>{t('bazi.chart.pillars')}</h3>
      <div className="bazi-pillar-scroll">
        <div className="bazi-pillars">
          <svg className="bazi-pillar-links" viewBox="0 0 400 240" aria-hidden="true">
            {chart.relations.stems.map((relation, i) => (
              <line
                key={i}
                x1={50 + PILLAR_KEYS.indexOf(relation.pillars[0]!) * 100}
                x2={50 + PILLAR_KEYS.indexOf(relation.pillars[1]!) * 100}
                y1={75 + i * 8}
                y2={75 + i * 8}
                stroke="var(--gold)"
                strokeDasharray={relation.type === 'clash' ? '4 4' : undefined}
                data-stem-relation={relation.type}
              />
            ))}
          </svg>
          {PILLAR_KEYS.map((key, i) => {
            const pillar = chart.pillars[key];
            const path = `pillars.${key}`;
            const active =
              isHighlighted(highlight, path) ||
              (key === 'day' && isHighlighted(highlight, 'dayMaster')) ||
              highlightedPillars(chart, highlight).includes(key);
            return (
              <div
                key={key}
                className="bazi-pillar"
                style={
                  {
                    '--pillar-color': pillar ? `var(--wu-${pillar.stemElement})` : 'var(--line-2)',
                    '--pillar-order': i,
                  } as React.CSSProperties
                }
              >
                <button
                  type="button"
                  data-chart-path={path}
                  data-pillar={key}
                  aria-pressed={active}
                  className={active ? 'chart-highlight' : undefined}
                  onClick={() => onSelect?.(path)}
                >
                  <span className="bazi-pillar-label">{t(`bazi.chart.${key}`)}</span>
                  {pillar ? (
                    <>
                      <span
                        className="bazi-ganzhi"
                        data-stem={pillar.stem}
                        style={{ color: `var(--wu-${pillar.stemElement})` }}
                      >
                        {t(`bazi.stems.${pillar.stem}`)}
                      </span>
                      <span className="bazi-element-name">
                        {t(`bazi.elements.${pillar.stemElement}`)}
                      </span>
                      <span
                        className="bazi-ganzhi"
                        data-branch={pillar.branch}
                        style={{ color: `var(--wu-${pillar.branchElement})` }}
                      >
                        {t(`bazi.branches.${pillar.branch}`)}
                      </span>
                      <span className="bazi-element-name">
                        {t(`bazi.elements.${pillar.branchElement}`)}
                      </span>
                      <span className="bazi-pillar-god">{t(`bazi.tenGods.${pillar.tenGod}`)}</span>
                    </>
                  ) : (
                    <span className="bazi-unknown">{t('common.unknown')}</span>
                  )}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
