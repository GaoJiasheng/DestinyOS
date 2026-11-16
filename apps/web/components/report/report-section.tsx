'use client';
import { Button } from '@/components/ui/button';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { TarotChartSchema } from '@tianji/shared';
import { TarotDetails } from '@/components/tarot/tarot-details';
import { notifySuccess } from '@/lib/notify';
import type { Report, Section, ReportBlock } from '@tianji/interpret';
import { useCopy } from '@/i18n/use-copy';
import type { MessageKey } from '@/i18n/catalog';
import { submitFeedbackAction } from '@/app/readings/actions';
import { ReportText } from './report-text';
import { ChartPreview } from './chart-preview';
import { openSection } from './focus-evidence';
import { sectionPreview } from './report-utils';
const uninformative = new Set(['成立', '不成立', 'Present', 'Absent']);
/** Deterministic one-page summary derived from the stored snapshot, so old reports need no new fields.
 * Takeaways are section leads ranked by the heaviest rule hit in each section, shown in plan order. */
export function summarize(report: Report): {
  takeaways: { key: string; title: string; text: string }[];
  advice: string[];
} {
  const weight = (key: string) =>
    report.hits.reduce((max, hit) => (hit.section === key ? Math.max(max, hit.weight) : max), 0);
  const ranked = report.sections
    .map((section, index) => ({ section, index, weight: weight(section.key) }))
    .filter((entry) => entry.section.key !== 'summary_actions' && entry.section.lead.trim())
    .sort((a, b) => b.weight - a.weight || a.index - b.index)
    .slice(0, 5)
    .sort((a, b) => a.index - b.index);
  const advice =
    report.sections
      .find((section) => section.key === 'summary_actions')
      ?.blocks.flatMap((block) => (block.type === 'advice' ? block.items : [])) ?? [];
  return {
    takeaways: ranked.map(({ section }) => ({
      key: section.key,
      title: section.title,
      text: sectionPreview(section) || section.lead,
    })),
    advice: (advice.length ? advice : (report.doDont?.do ?? [])).slice(0, 3),
  };
}
/** First-screen summary card: ranked takeaways linked to their sections, top advice, one usage note
 * and optional follow-up actions such as the chat entry. */
export function ReportSummary({ report, children }: { report: Report; children?: ReactNode }) {
  const t = useCopy();
  const { takeaways, advice } = summarize(report);
  const fallback = report.headline.persona.trim();
  if (!takeaways.length && !advice.length && !fallback) return null;
  return (
    <section id="report-summary" className="report-summary report-card">
      <h2 className="type-h2">{t('report.brief.title')}</h2>
      {takeaways.length ? (
        <ol className="summary-takeaways" aria-label={t('report.brief.takeaways')}>
          {takeaways.map((item) => (
            <li key={item.key}>
              <ReportText text={item.text} />{' '}
              <a href={`#section-${item.key}`} onClick={() => openSection(item.key)}>
                <ReportText text={item.title} />
              </a>
            </li>
          ))}
        </ol>
      ) : fallback ? (
        <p className="section-lead">
          <ReportText text={fallback} />
        </p>
      ) : null}
      {advice.length ? (
        <>
          <h3>{t('report.brief.advice')}</h3>
          <ul className="summary-advice">
            {advice.map((text, i) => (
              <li key={i}>
                <ReportText text={text} />
              </li>
            ))}
          </ul>
        </>
      ) : null}
      <p className="muted summary-howto">{t('report.brief.howto')}</p>
      {children}
    </section>
  );
}
/** Evidence links focus the chart and mark the matching path without disclosing birth input. */
export function EvidenceTags({
  items,
  onEvidence,
}: {
  items: Extract<ReportBlock, { type: 'evidence' }>['items'];
  onEvidence: (path: string) => void;
}) {
  const t = useCopy();
  // A bare boolean predicate ("成立: 成立") carries no information; a label repeating its value is shown once.
  const shown = items.filter((item) => item.value && !uninformative.has(item.value));
  if (!shown.length) return null;
  return (
    <div className="evidence-tags">
      <span>{t('report.evidence')}</span>
      {shown.map((item, i) => (
        <button type="button" key={i} onClick={() => onEvidence(item.path)}>
          <ReportText
            text={item.label === item.value ? item.value : `${item.label}: ${item.value}`}
          />
        </button>
      ))}
    </div>
  );
}
/** Render practical suggestions from the report snapshot. */
export function AdviceList({ items }: { items: string[] }) {
  const t = useCopy();
  return (
    <aside className="advice-list">
      <h3>{t('report.advice')}</h3>
      <ul>
        {items.map((text, i) => (
          <li key={i}>
            <ReportText text={text} />
          </li>
        ))}
      </ul>
    </aside>
  );
}
/** Keep original source quotations out of the primary prose until expanded. */
export function SourceFold({
  items,
}: {
  items: Extract<ReportBlock, { type: 'sources' }>['items'];
}) {
  const t = useCopy();
  return (
    <details className="source-fold">
      <summary>{t('report.sources')}</summary>
      {items.map((s, i) => (
        <blockquote key={i}>
          <ReportText text={s.text} />
          <cite>
            <ReportText text={s.from} />
          </cite>
        </blockquote>
      ))}
    </details>
  );
}
/** Persist one vote per visible interaction; local reports omit the server reading foreign key. */
export function FeedbackBar({ readingId, sectionKey }: { readingId?: string; sectionKey: string }) {
  const t = useCopy();
  const [vote, setVote] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<MessageKey | null>(null);
  return (
    <div className="feedback-bar">
      <span>{t('report.feedback')}</span>
      {([1, -1] as const).map((v) => (
        <Button
          variant="ghost"
          key={v}
          type="button"
          disabled={busy}
          aria-pressed={vote === v}
          aria-label={t(v === 1 ? 'report.feedback.yes' : 'report.feedback.no')}
          action={async () => {
            setBusy(true);
            setError(null);
            await submitFeedbackAction({ readingId, sectionKey, vote: v })
              .then((result) => {
                if (result.ok) {
                  setVote(v);
                  notifySuccess(t('report.feedback.saved'));
                } else setError(`report.error.${result.error.code}` as MessageKey);
              })
              .catch(() => setError('report.error.E_INTERNAL'))
              .finally(() => setBusy(false));
          }}
        >
          {v === 1 ? '👍' : '👎'}
        </Button>
      ))}
      {error ? <p role="alert">{t(error)}</p> : null}
    </div>
  );
}
/** Exhaustively render all six documented block types; text is escaped and glossary-aware. */
export function ReportSection({
  section,
  chart,
  onEvidence,
  readingId,
  highlight,
  onChartSelect,
  selected = false,
}: {
  section: Section;
  chart: unknown;
  onEvidence: (path: string) => void;
  readingId?: string;
  highlight?: string;
  onChartSelect?: (path: string) => void;
  selected?: boolean;
}) {
  const tarot = section.key === 'cards' ? TarotChartSchema.safeParse(chart) : null;
  const t = useCopy();
  const fold = useRef<HTMLDetailsElement>(null);
  const preview = sectionPreview(section);
  useEffect(() => {
    const element = fold.current;
    if (!element) return;
    let openedForPrint = false;
    const showIfTargeted = () => {
      if (window.location.hash === `#section-${section.key}`) element.open = true;
    };
    // Browser printing must include every topic, then restore the reader's own fold state.
    const beforePrint = () => {
      if (!element.open) openedForPrint = true;
      element.open = true;
    };
    const afterPrint = () => {
      if (openedForPrint) element.open = false;
      openedForPrint = false;
    };
    showIfTargeted();
    window.addEventListener('hashchange', showIfTargeted);
    window.addEventListener('beforeprint', beforePrint);
    window.addEventListener('afterprint', afterPrint);
    return () => {
      window.removeEventListener('hashchange', showIfTargeted);
      window.removeEventListener('beforeprint', beforePrint);
      window.removeEventListener('afterprint', afterPrint);
    };
  }, [section.key]);
  return (
    <section
      id={`section-${section.key}`}
      tabIndex={-1}
      className={`report-section report-card${selected ? ' evidence-highlight' : ''}`}
    >
      <h2 className="type-h2">
        <ReportText text={section.title} />
      </h2>
      <p className="section-lead">
        <ReportText text={section.lead} />
      </p>
      {preview ? (
        <p className="section-preview muted">
          <ReportText text={preview} />
        </p>
      ) : null}
      {tarot?.success ? <TarotDetails chart={tarot.data} /> : null}
      <details className="section-fold" ref={fold}>
        <summary>{t('report.section.expand')}</summary>
        {section.blocks.map((block, i) => {
          switch (block.type) {
            case 'paragraph':
              return (
                <p className="report-paragraph" key={i} data-unit-id={block.unitId}>
                  <ReportText text={block.text} />
                </p>
              );
            case 'transition':
              return (
                <p className="report-transition" key={i}>
                  <ReportText text={block.text} />
                </p>
              );
            case 'evidence':
              return <EvidenceTags key={i} items={block.items} onEvidence={onEvidence} />;
            case 'advice':
              return <AdviceList key={i} items={block.items} />;
            case 'sources':
              return <SourceFold key={i} items={block.items} />;
            case 'chart_ref':
              return (
                <ChartReference
                  key={i}
                  block={block}
                  chart={chart}
                  highlight={highlight}
                  onSelect={onChartSelect}
                />
              );
          }
        })}
        <FeedbackBar readingId={readingId} sectionKey={section.key} />
      </details>
    </section>
  );
}
function ChartReference({
  block,
  chart,
  highlight,
  onSelect,
}: {
  block: Extract<ReportBlock, { type: 'chart_ref' }>;
  chart: unknown;
  highlight?: string;
  onSelect?: (path: string) => void;
}) {
  const t = useCopy();
  return (
    <figure className="chart-reference">
      <figcaption className="sr-only">
        {t('report.chartRef', {
          component: t(
            (
              {
                BaziPillars: 'bazi.chart.pillars',
                ElementRing: 'bazi.chart.elements',
                StrengthGauge: 'bazi.chart.strength',
                LuckTimeline: 'bazi.chart.luck',
                BranchRelationDiagram: 'bazi.chart.relations',
              } as Record<string, MessageKey>
            )[block.component] ?? 'report.chart',
          ),
        })}
      </figcaption>
      <ChartPreview
        chart={chart}
        component={block.component}
        highlight={highlight}
        onSelect={onSelect}
      />
    </figure>
  );
}
/** Sticky, horizontally scrolling section anchors support both keyboard and touch. */
export function SectionNav({ sections }: { sections: Section[] }) {
  const t = useCopy();
  return (
    <nav aria-label={t('report.nav')} className="section-nav">
      {sections.map((s) => (
        <a key={s.key} href={`#section-${s.key}`} onClick={() => openSection(s.key)}>
          <ReportText text={s.title} />
        </a>
      ))}
    </nav>
  );
}
export { AdSlot } from '@/components/ads/ad-slot';
