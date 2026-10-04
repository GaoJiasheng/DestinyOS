'use client';
import { useState } from 'react';
import { TarotChartSchema } from '@tianji/shared';
import { TarotDetails } from '@/components/tarot/tarot-details';
import { toast } from 'sonner';
import type { Section, ReportBlock } from '@tianji/interpret';
import { useCopy } from '@/i18n/use-copy';
import type { MessageKey } from '@/i18n/catalog';
import { submitFeedbackAction } from '@/app/readings/actions';
import { ReportText } from './report-text';
import { ChartPreview } from './chart-preview';
/** Evidence links focus the chart and mark the matching path without disclosing birth input. */
export function EvidenceTags({
  items,
  onEvidence,
}: {
  items: Extract<ReportBlock, { type: 'evidence' }>['items'];
  onEvidence: (path: string) => void;
}) {
  const t = useCopy();
  return (
    <div className="evidence-tags">
      <span>{t('report.evidence')}</span>
      {items.map((item, i) => (
        <button type="button" key={i} onClick={() => onEvidence(item.path)}>
          <ReportText text={`${item.label}: ${item.value}`} />
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
  return (
    <div className="feedback-bar">
      <span>{t('report.feedback')}</span>
      {([1, -1] as const).map((v) => (
        <button
          key={v}
          type="button"
          disabled={busy}
          aria-pressed={vote === v}
          aria-label={t(v === 1 ? 'report.feedback.yes' : 'report.feedback.no')}
          onClick={() => {
            setBusy(true);
            void submitFeedbackAction({ readingId, sectionKey, vote: v })
              .then((result) => {
                if (result.ok) {
                  setVote(v);
                  toast.success(t('report.feedback.saved'));
                } else toast.error(t(`report.error.${result.error.code}` as MessageKey));
              })
              .finally(() => setBusy(false));
          }}
        >
          {v === 1 ? '👍' : '👎'}
        </button>
      ))}
    </div>
  );
}
/** Exhaustively render all six documented block types; text is escaped and glossary-aware. */
export function ReportSection({
  section,
  chart,
  onEvidence,
  readingId,
}: {
  section: Section;
  chart: unknown;
  onEvidence: (path: string) => void;
  readingId?: string;
}) {
  const tarot = section.key === 'cards' ? TarotChartSchema.safeParse(chart) : null;
  return (
    <section id={`section-${section.key}`} className="report-section report-card">
      <h2 className="type-h2">
        <ReportText text={section.title} />
      </h2>
      <p className="section-lead">
        <ReportText text={section.lead} />
      </p>
      {tarot?.success ? <TarotDetails chart={tarot.data} /> : null}
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
            return <ChartReference key={i} block={block} chart={chart} />;
        }
      })}
      <FeedbackBar readingId={readingId} sectionKey={section.key} />
    </section>
  );
}
function ChartReference({
  block,
  chart,
}: {
  block: Extract<ReportBlock, { type: 'chart_ref' }>;
  chart: unknown;
}) {
  const t = useCopy();
  return (
    <figure className="chart-reference">
      <figcaption>{t('report.chartRef', { component: block.component })}</figcaption>
      <ChartPreview chart={chart} />
      {Object.keys(block.props).length ? (
        <pre className="technical-data">
          {t('report.content', { text: JSON.stringify(block.props, null, 2) })}
        </pre>
      ) : null}
    </figure>
  );
}
/** Sticky, horizontally scrolling section anchors support both keyboard and touch. */
export function SectionNav({ sections }: { sections: Section[] }) {
  const t = useCopy();
  return (
    <nav aria-label={t('report.nav')} className="section-nav">
      {sections.map((s) => (
        <a key={s.key} href={`#section-${s.key}`}>
          <ReportText text={s.title} />
        </a>
      ))}
    </nav>
  );
}
/** Reserved fixed-height advertisement slot, excluded for pro plans; no ad network is loaded in T-32. */
export function AdSlot({ slot, plan = 'free' }: { slot: string; plan?: 'free' | 'pro' }) {
  const t = useCopy();
  return plan === 'pro' ? null : (
    <aside className="ad-slot" data-ad-slot={slot} aria-label={t('report.ad')}>
      <span>{t('report.ad')}</span>
    </aside>
  );
}
