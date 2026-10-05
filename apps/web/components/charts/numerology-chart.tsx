'use client';
import { motion, useReducedMotion } from 'motion/react';
import type { NumerologyChart as Chart } from '@tianji/shared';
import { useCopy } from '@/i18n/use-copy';
/** Accessible birthday digit grid and nine-year SVG cycle; motion respects the reduced-motion preference. */
export function NumerologyChart({
  chart,
  highlight,
  onSelect,
}: {
  chart: Chart;
  highlight?: string;
  onSelect?: (section: string, path?: string) => void;
}) {
  const t = useCopy();
  const reduce = useReducedMotion();
  const number = (value: number | null) =>
    value === null ? t('numerology.empty') : t('common.number', { value });
  const metrics = [
    ['lifePath', chart.lifePath.number, 'lifePath.number'],
    ['birthday', chart.birthday.number, 'birthday.day'],
    ['expression', chart.nameNumbers?.expression.number ?? null, 'nameNumbers.expression.number'],
    ['soul', chart.nameNumbers?.soul.number ?? null, 'nameNumbers.soul.number'],
    [
      'personality',
      chart.nameNumbers?.personality.number ?? null,
      'nameNumbers.personality.number',
    ],
  ] as const;
  return (
    <div id="chart-root" tabIndex={-1} className="numerology-chart" data-highlight={highlight}>
      <p className="type-caption muted">{t('numerology.school')}</p>
      <div className="numerology-metrics">
        {metrics.map(([key, value, path]) => (
          <button
            type="button"
            key={key}
            className={`numerology-metric${highlight === path ? ' evidence-highlight' : ''}`}
            data-chart-path={path}
            onClick={() =>
              onSelect?.(
                key === 'lifePath' ? 'life_path' : key === 'birthday' ? 'birthday' : 'name_numbers',
                path,
              )
            }
          >
            <span>{t(`numerology.${key}`)}</span>
            <motion.strong
              initial={reduce ? false : { opacity: 0, scale: 0.75 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5 }}
            >
              {number(value)}
            </motion.strong>
          </button>
        ))}
      </div>
      <h3>{t('numerology.grid')}</h3>
      <p className="type-small muted">{t('numerology.gridHelp')}</p>
      <div className="numerology-grid" role="group" aria-label={t('numerology.grid')}>
        {[3, 6, 9, 2, 5, 8, 1, 4, 7].map((digit) => {
          const count = chart.grid.find((cell) => cell.digit === digit)!.count;
          return (
            <div
              key={digit}
              role="img"
              className={count ? 'populated' : ''}
              aria-label={t('numerology.gridCell', { digit, count })}
            >
              <span className="type-caption">{number(digit)}</span>
              <strong>
                {count
                  ? t('report.content', {
                      text: Array.from({ length: count }, () => digit).join(' '),
                    })
                  : t('numerology.empty')}
              </strong>
            </div>
          );
        })}
      </div>
      <h3>{t('numerology.cycles')}</h3>
      <svg
        viewBox="0 0 300 300"
        role="img"
        aria-label={t('numerology.cycles')}
        className="numerology-cycle"
      >
        <title>{t('numerology.cycles')}</title>
        <circle cx="150" cy="150" r="105" fill="none" stroke="currentColor" opacity="0.3" />
        {chart.cycles.map((cycle, i) => {
          const angle = (i * Math.PI * 2) / 9 - Math.PI / 2;
          const x = 150 + 105 * Math.cos(angle),
            y = 150 + 105 * Math.sin(angle);
          return (
            <g key={cycle.year}>
              <circle
                cx={x}
                cy={y}
                r="23"
                fill="var(--surface-1)"
                stroke="currentColor"
                strokeWidth={cycle.isCurrent ? 3 : 1}
              />
              <text x={x} y={y + 4} textAnchor="middle" fill="currentColor">
                {number(cycle.number)}
              </text>
              <text x={x} y={y + 36} textAnchor="middle" fill="currentColor" fontSize="11">
                {t('report.content', { text: String(cycle.year) })}
              </text>
            </g>
          );
        })}
        <text x="150" y="146" textAnchor="middle" fill="currentColor">
          {t('numerology.personalYear')}
        </text>
        <text x="150" y="171" textAnchor="middle" fill="currentColor" fontSize="24">
          {number(chart.personal.year)}
        </text>
      </svg>
      <p>
        {t('numerology.personalSummary', {
          year: chart.personal.year,
          month: chart.personal.month,
          day: chart.personal.day,
        })}
      </p>
      <p className="type-caption muted">{t('numerology.cycleHelp')}</p>
      {!chart.nameNumbers ? <p className="notice">{t('numerology.noName')}</p> : null}
      <p className="type-small muted">{t('numerology.compatibilityHelp')}</p>
    </div>
  );
}
