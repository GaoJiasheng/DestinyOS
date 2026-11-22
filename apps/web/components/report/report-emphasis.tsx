'use client';
import { useState } from 'react';
import { useLocale } from 'next-intl';
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
  type EmphasisDimension,
} from '@tianji/interpret/emphasis';
import { useCopy } from '@/i18n/use-copy';
import { EMPHASIS_DIMS, orderBasis, type ShownDim } from './report-emphasis-order';
import './report-emphasis.css';
/** Four segments for bands 2–5; a band is a relative weight, so no number is ever shown. */
function Meter({ level, label }: { level: number; label: string }) {
  return (
    <span className="emphasis-meter" role="img" aria-label={label} data-level={level}>
      {[2, 3, 4, 5].map((n) => (
        <i key={n} data-on={n <= level || undefined} />
      ))}
    </span>
  );
}
const markOf = (delta: number) => (delta > 0 ? '+' : delta < 0 ? '−' : '·');
/** Evidence path of the palace a rule read, in the form report evidence links already use. */
const palacePath = (palace: string | undefined) =>
  palace && /^[a-z_]+$/.test(palace) ? `palaces[key=${palace}]` : undefined;
function Dimension({
  dim,
  value,
  locale,
  onPalace,
}: {
  dim: ShownDim;
  value: EmphasisDimension;
  locale: Locale;
  onPalace?: (path: string) => void;
}) {
  const t = useCopy();
  const [open, setOpen] = useState(false);
  const level = emphasisLevelLabel(value.level, locale);
  // Unknown rule ids (a newer report on an older bundle) render as '' and are skipped.
  const lines = orderBasis(value.basis)
    .map((basis) => ({ basis, text: renderEmphasisBasis(basis, locale) }))
    .filter((line) => line.text);
  return (
    <li className="emphasis-dim" data-dim={dim} data-level={value.level}>
      <div className="emphasis-dim-head">
        <span className="emphasis-dim-name">{emphasisDimLabel(dim, locale)}</span>
        <Meter level={value.level} label={t('report.emphasis.meter', { level })} />
        <span className="emphasis-level">{level}</span>
      </div>
      <p className="emphasis-sentence">{emphasisDimSentence(dim, value.level, locale)}</p>
      {/* DESIGN-GAP: components/ui has no disclosure primitive; report folds use native details/summary (44px via the global summary rule). */}
      <details className="emphasis-basis" onToggle={(e) => setOpen(e.currentTarget.open)}>
        <summary>{t(open ? 'report.emphasis.basisHide' : 'report.emphasis.basisShow')}</summary>
        {lines.length ? (
          <ul>
            {lines.map(({ basis, text }, i) => (
              <li key={i} data-direction={Math.sign(basis.delta)}>
                <span
                  className="emphasis-mark"
                  aria-label={t(
                    basis.delta > 0
                      ? 'report.emphasis.positive'
                      : basis.delta < 0
                        ? 'report.emphasis.negative'
                        : 'report.emphasis.neutral',
                  )}
                  role="img"
                >
                  {markOf(basis.delta)}
                </span>
                {onPalace && palacePath(basis.params.palace) ? (
                  <button
                    type="button"
                    className="emphasis-basis-link"
                    title={t('report.emphasis.showOnChart')}
                    onClick={() => onPalace(palacePath(basis.params.palace)!)}
                  >
                    {text}
                  </button>
                ) : (
                  <span>{text}</span>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted">{t('report.emphasis.basisEmpty')}</p>
        )}
        <p className="emphasis-note">{emphasisFootnotes(locale).brightness}</p>
      </details>
    </li>
  );
}
/** Chart emphasis: overview sentence, four banded dimensions with expandable rule basis, fixed footnotes.
 * Loaded lazily, and only for reports that carry `headline.emphasis`. */
export function ReportEmphasis({
  emphasis,
  onPalace,
}: {
  emphasis: Emphasis;
  /** Highlight the palace a rule read on the report's chart; omitted where no chart is shown. */
  onPalace?: (path: string) => void;
}) {
  const locale = useLocale() as Locale;
  const overview = emphasisOverview(emphasis, locale);
  const notes = emphasisFootnotes(locale);
  const shown = EMPHASIS_DIMS.flatMap((dim) => {
    const value = emphasis.dims[dim];
    return value ? [{ dim, value }] : [];
  });
  if (!shown.length) return null;
  return (
    <section className="report-emphasis" aria-labelledby="report-emphasis-title">
      <h3 id="report-emphasis-title" className="emphasis-title">
        {emphasisTitle(locale)}
      </h3>
      {overview ? <p className="emphasis-overview">{overview}</p> : null}
      <ul className="emphasis-dims">
        {shown.map(({ dim, value }) => (
          <Dimension key={dim} dim={dim} value={value} locale={locale} onPalace={onPalace} />
        ))}
      </ul>
      <footer className="emphasis-footnotes">
        <p>{notes.disclaimer}</p>
        <p>{notes.health}</p>
        <p>{notes.crossSystem}</p>
      </footer>
    </section>
  );
}
