'use client';
import { motion, useReducedMotion } from 'motion/react';
import { useCopy } from '@/i18n/use-copy';
import { isHighlighted, type BaziChartProps } from './bazi-shared';

/** Animate a −6…+6 scale; keep scores outside the visual range readable at their actual value. */
export function StrengthGauge({ chart, highlight, onSelect }: BaziChartProps) {
  const t = useCopy();
  const reduced = useReducedMotion();
  const { score, level, confidence } = chart.strength;
  // DESIGN-GAP: The unbounded engine score is clamped only at the visual pointer, never in displayed data.
  const bounded = Math.max(-6, Math.min(6, score));
  return (
    <section className="bazi-component" data-chart-path="strength" tabIndex={-1}>
      <h3>{t('bazi.chart.strength')}</h3>
      <button
        type="button"
        className={
          isHighlighted(highlight, 'strength')
            ? 'bazi-gauge-button chart-highlight'
            : 'bazi-gauge-button'
        }
        aria-pressed={isHighlighted(highlight, 'strength')}
        onClick={() => onSelect?.('strength')}
      >
        <span>
          {t('bazi.chart.strengthValue', {
            level: t(`bazi.strength.${level}`),
            score: score.toFixed(1),
          })}
        </span>
        <span
          className="bazi-gauge"
          role="meter"
          aria-label={t('bazi.chart.strength')}
          aria-valuemin={-6}
          aria-valuemax={6}
          aria-valuenow={bounded}
          aria-valuetext={t('bazi.chart.strengthValue', {
            level: t(`bazi.strength.${level}`),
            score: score.toFixed(1),
          })}
          data-score={score}
        >
          <motion.span
            className="bazi-gauge-pointer"
            initial={{ x: reduced ? `${((bounded + 6) / 12) * 100}%` : '50%' }}
            animate={{ x: `${((bounded + 6) / 12) * 100}%` }}
            transition={{ duration: reduced ? 0.15 : 0.5, ease: [0.2, 0.8, 0.2, 1] }}
          >
            <span />
          </motion.span>
        </span>
        <span className="bazi-gauge-ticks" aria-hidden="true">
          {[-6, -3, 0, 3, 6].map((tick) => (
            <span key={tick}>
              {t('report.content', { text: tick > 0 ? `+${tick}` : String(tick) })}
            </span>
          ))}
        </span>
        <span className="muted">
          {t('bazi.chart.confidence', { pct: Math.round(confidence * 100) })}
        </span>
      </button>
    </section>
  );
}
