'use client';
import { motion, useReducedMotion } from 'motion/react';
import type { Report } from '@tianji/interpret';
import { useCopy } from '@/i18n/use-copy';
import { ReportText } from './report-text';
const dims = ['career', 'wealth', 'love', 'health', 'social'] as const;
/** Animated SVG radar includes a text table so dimension scores never rely on color or geometry. */
export function ScoreRadar({ scores }: { scores: Report['headline']['scores'] }) {
  const t = useCopy();
  const reduced = useReducedMotion();
  const point = (i: number, r: number) => [
    150 + Math.sin((i * 2 * Math.PI) / 5) * r,
    145 - Math.cos((i * 2 * Math.PI) / 5) * r,
  ];
  return (
    <div className="score-radar">
      <svg viewBox="0 0 300 300" role="img" aria-label={t('report.radar')}>
        {[1, 2, 3, 4, 5].map((n) => (
          <polygon
            key={n}
            points={dims.map((_, i) => point(i, n * 18).join(',')).join(' ')}
            fill="none"
            stroke="var(--line-2)"
          />
        ))}
        {dims.map((d, i) => {
          const [x, y] = point(i, 120);
          return (
            <text key={d} x={x} y={y} textAnchor="middle" fill="var(--text-2)" fontSize="13">
              {t(`report.dim.${d}`)}
            </text>
          );
        })}
        <motion.polygon
          initial={reduced ? false : { opacity: 0, scale: 0.6 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6 }}
          style={{ transformOrigin: '150px 145px' }}
          points={dims.map((d, i) => point(i, scores[d] * 18).join(',')).join(' ')}
          fill="var(--accent-glow)"
          stroke="var(--gold)"
          strokeWidth="2"
        />
      </svg>
      <dl className="score-values">
        {dims.map((d) => (
          <div key={d}>
            <dt>{t(`report.dim.${d}`)}</dt>
            <dd>{scores[d]} / 5</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
/** Report lead, three keywords and confidence are localized content from the interpretation snapshot. */
export function ReportHeadline({ headline }: { headline: Report['headline'] }) {
  const t = useCopy();
  return (
    <section className="report-headline report-card">
      <p className="eyebrow">{t('report.summary')}</p>
      <h2 className="type-h2">
        <ReportText text={headline.persona} />
      </h2>
      <div className="keyword-row">
        {headline.keywords.slice(0, 3).map((k) => (
          <span className="keyword-chip" key={k}>
            <ReportText text={k} />
          </span>
        ))}
      </div>
      <ScoreRadar scores={headline.scores} />
      <p>{t('report.confidence', { percent: Math.round(headline.confidence * 100) })}</p>
      <progress
        max={1}
        value={headline.confidence}
        aria-label={t('report.confidence', { percent: Math.round(headline.confidence * 100) })}
      />
      {headline.confidence < 0.7 ? <p className="notice">{t('report.confidence.low')}</p> : null}
    </section>
  );
}
