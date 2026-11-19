'use client';
import { radarPoint, SCORE_DIMENSIONS } from '@tianji/ui-core';
import { motion, useReducedMotion } from 'motion/react';
import type { Report } from '@tianji/interpret';
import { useCopy } from '@/i18n/use-copy';
import { ReportText } from './report-text';
import { hasScoreSpread, isDivination } from './report-utils';
import dynamic from 'next/dynamic';
import { ChunkLoading } from '@/components/ui/chunk-loading';
import { ChunkUnavailable } from '@/components/ui/chunk-unavailable';
// Emphasis renderers and their copy load only for reports that carry `headline.emphasis`.
const ReportEmphasis = dynamic(
  () =>
    import('./report-emphasis')
      .then((module) => module.ReportEmphasis)
      .catch(() => ChunkUnavailable),
  { loading: ChunkLoading },
);
const dims = SCORE_DIMENSIONS;
/** Animated SVG radar includes a text table so dimension scores never rely on color or geometry. */
export function ScoreRadar({ scores }: { scores: Report['headline']['scores'] }) {
  const t = useCopy();
  const reduced = useReducedMotion();
  const point = radarPoint;
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
/** Report lead, three keywords and confidence are localized content from the interpretation snapshot.
 * Divination draws (tarot, I Ching, Qimen) have no natal profile, so the five-dimension scores and
 * confidence meter are omitted for them; any report with five identical scores omits the radar. */
export function ReportHeadline({
  headline,
  system,
}: {
  headline: Report['headline'];
  system: string;
}) {
  const t = useCopy();
  const divination = isDivination(system);
  return (
    <section className="report-headline report-card">
      <p className="eyebrow">{t(divination ? 'report.readingSummary' : 'report.summary')}</p>
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
      {!divination && hasScoreSpread(headline.scores) ? (
        <ScoreRadar scores={headline.scores} />
      ) : null}
      {!divination && headline.emphasis ? <ReportEmphasis emphasis={headline.emphasis} /> : null}
      {divination ? null : (
        <>
          <p>{t('report.confidence', { percent: Math.round(headline.confidence * 100) })}</p>
          <progress
            max={1}
            value={headline.confidence}
            aria-label={t('report.confidence', {
              percent: Math.round(headline.confidence * 100),
            })}
          />
          {headline.confidence < 0.7 ? (
            <p className="notice">{t('report.confidence.low')}</p>
          ) : null}
        </>
      )}
    </section>
  );
}
