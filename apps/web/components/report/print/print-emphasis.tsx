'use client';
import { useLocale, useTranslations } from 'next-intl';
import type { Locale } from '@tianji/shared';
import {
  emphasisDimLabel,
  emphasisDimSentence,
  emphasisFootnotes,
  emphasisLevelLabel,
  emphasisOverview,
  emphasisTitle,
  renderEmphasisBasis,
  type Emphasis,
} from '@tianji/interpret/emphasis';
import { EMPHASIS_DIMS, orderBasis } from '../report-emphasis-order';
/** Basis lines per dimension on paper; the screen module lists them all behind a disclosure. */
const PRINT_BASIS_LIMIT = 3;
/** Print/poster chart emphasis: overview, banded dimensions with up to three basis lines, footnotes.
 * Band words and segment marks only, never a score or "x/5". */
export function PrintEmphasis({ emphasis }: { emphasis: Emphasis }) {
  const t = useTranslations();
  const locale = useLocale() as Locale;
  const overview = emphasisOverview(emphasis, locale);
  const notes = emphasisFootnotes(locale);
  const shown = EMPHASIS_DIMS.flatMap((dim) => {
    const value = emphasis.dims[dim];
    return value ? [{ dim, value }] : [];
  });
  if (!shown.length) return null;
  return (
    <section data-print-section="emphasis" className="print-emphasis">
      <div className="print-chapter-heading" data-print-block>
        <h2>{emphasisTitle(locale)}</h2>
        {overview ? <p className="print-lead">{overview}</p> : null}
      </div>
      {shown.map(({ dim, value }) => {
        const level = emphasisLevelLabel(value.level, locale);
        const lines = orderBasis(value.basis)
          .map((basis) => ({ delta: basis.delta, text: renderEmphasisBasis(basis, locale) }))
          .filter((line) => line.text)
          .slice(0, PRINT_BASIS_LIMIT);
        return (
          <div className="print-emphasis-dim" key={dim} data-dim={dim} data-print-block>
            <p className="print-emphasis-head">
              <strong>{emphasisDimLabel(dim, locale)}</strong>
              <span className="print-emphasis-meter" aria-hidden="true">
                {[2, 3, 4, 5].map((n) => (
                  <i key={n} data-on={n <= value.level || undefined} />
                ))}
              </span>
              <span className="print-emphasis-level">{level}</span>
            </p>
            <p>{emphasisDimSentence(dim, value.level, locale)}</p>
            {lines.length ? (
              <ul aria-label={t('report.evidence')}>
                {lines.map((line, i) => (
                  <li key={i}>
                    <span aria-hidden="true">
                      {line.delta > 0 ? '+' : line.delta < 0 ? '−' : '·'}
                    </span>
                    {line.text}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        );
      })}
      <div className="print-footnote print-emphasis-notes" data-print-block>
        <p>{notes.disclaimer}</p>
        <p>{notes.health}</p>
        <p>{notes.crossSystem}</p>
        <p>{notes.brightness}</p>
      </div>
    </section>
  );
}
