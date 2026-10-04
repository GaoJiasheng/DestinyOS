'use client';
import { useId, useState } from 'react';
import { useCopy } from '@/i18n/use-copy';
import { chartPath, isHighlighted, type BaziChartProps } from './bazi-shared';

/** Expand any of the ten luck periods using only annual records present in the report snapshot. */
export function LuckTimeline({ chart, highlight, onSelect }: BaziChartProps) {
  const t = useCopy();
  const id = useId();
  const h = chartPath(highlight ?? '');
  const highlightedYear = chart.years.find((_, i) => isHighlighted(highlight, `years.${i}`));
  const highlightedPeriod = h.match(/^luck\.periods\.(\d+)(?:\.|$)/);
  const evidenceIndex = highlightedPeriod
    ? Number(highlightedPeriod[1])
    : highlightedYear
      ? chart.luck.periods.findIndex(
          (period) =>
            highlightedYear.year >= period.fromYear && highlightedYear.year <= period.toYear,
        )
      : -1;
  const [selection, setSelection] = useState<{
    highlight: string | undefined;
    index: number | null;
  }>({ highlight, index: evidenceIndex >= 0 ? evidenceIndex : null });
  // New evidence opens its period; later user clicks can still select or close another period.
  if (selection.highlight !== highlight) {
    setSelection({ highlight, index: evidenceIndex >= 0 ? evidenceIndex : null });
  }
  const activeIndex =
    selection.highlight !== highlight
      ? evidenceIndex >= 0
        ? evidenceIndex
        : null
      : selection.index;
  // DESIGN-GAP: Display fractional ages to one decimal; data attributes retain the exact engine ages.
  const active = activeIndex === null ? undefined : chart.luck.periods[activeIndex];
  // DESIGN-GAP: Charts contain current year ±10 only; absent annual records stay empty instead of recalculating a saved reading.
  const years = active
    ? chart.years.filter((year) => year.year >= active.fromYear && year.year <= active.toYear)
    : [];
  return (
    <section className="bazi-component" data-chart-path="luck" tabIndex={-1}>
      <h3>{t('bazi.chart.luck')}</h3>
      <p className="muted">
        {t('bazi.chart.startAge', chart.luck.startAge)} · {t(`bazi.chart.${chart.luck.direction}`)}
      </p>
      <ol className="bazi-luck-axis">
        {chart.luck.periods.map((period, i) => (
          <li key={period.index}>
            <button
              type="button"
              data-chart-path={`luck.periods.${i}`}
              data-period={period.index}
              data-from-age={period.fromAge}
              data-to-age={period.toAge}
              data-current={period.isCurrent}
              aria-current={period.isCurrent ? 'step' : undefined}
              aria-expanded={activeIndex === i}
              aria-controls={id}
              onClick={() => setSelection({ highlight, index: activeIndex === i ? null : i })}
            >
              <span className="bazi-period-ganzhi">
                {t(`bazi.stems.${period.stem}`)} · {t(`bazi.branches.${period.branch}`)}
              </span>
              <span>{t('bazi.chart.yearRange', { from: period.fromYear, to: period.toYear })}</span>
              <span>
                {t('bazi.chart.ageRange', {
                  from: period.fromAge.toFixed(1),
                  to: period.toAge.toFixed(1),
                })}
              </span>
              <span>{t(`bazi.tenGods.${period.tenGod}`)}</span>
              <span className="bazi-current-label">
                {period.isCurrent ? t('bazi.chart.current') : t('bazi.chart.expandYears')}
              </span>
            </button>
          </li>
        ))}
      </ol>
      <div id={id} className="bazi-luck-years" hidden={!active}>
        {active ? (
          <>
            <h4>{t('bazi.chart.annualHeading', { from: active.fromYear, to: active.toYear })}</h4>
            {!years.length ? (
              <p className="muted">{t('bazi.chart.noYears')}</p>
            ) : (
              <ul>
                {years.map((year) => {
                  const path = `years.${chart.years.indexOf(year)}`;
                  return (
                    <li key={year.year}>
                      <button
                        type="button"
                        data-chart-path={path}
                        data-year={year.year}
                        aria-pressed={isHighlighted(highlight, path)}
                        aria-current={year.isCurrent ? 'date' : undefined}
                        onClick={() => onSelect?.(path)}
                      >
                        {t('bazi.chart.annualValue', {
                          year: year.year,
                          stem: t(`bazi.stems.${year.stem}`),
                          branch: t(`bazi.branches.${year.branch}`),
                          god: t(`bazi.tenGods.${year.tenGod}`),
                        })}
                        {year.isCurrent ? (
                          <span className="bazi-current-label">{t('bazi.chart.current')}</span>
                        ) : null}
                      </button>
                      <p className="muted">
                        {t('bazi.chart.natalRelations', {
                          relations:
                            year.relationsToNatal
                              .map((r) => t(`bazi.relations.${r.type}`))
                              .join(' · ') || t('bazi.chart.none'),
                        })}
                      </p>
                      <p className="muted">
                        {t('bazi.chart.luckRelations', {
                          relations:
                            year.relationsToLuck
                              .map((r) => t(`bazi.relations.${r.type}`))
                              .join(' · ') || t('bazi.chart.none'),
                        })}
                      </p>
                    </li>
                  );
                })}
              </ul>
            )}
          </>
        ) : null}
      </div>
    </section>
  );
}
