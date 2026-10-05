'use client';
import type { AstroChart, VedicChart } from '@tianji/shared';
import type { ReadingView } from '@/lib/reading-schema';
import { useCopy } from '@/i18n/use-copy';
import { PlanetTable, HouseTable } from '../charts/planet-table';
import { AspectTable } from '../charts/aspect-table';
import { DashaTimeline } from '../charts/dasha-timeline';
import { ProfessionalData } from './professional-data';
/** Professional tables and raw snapshot disclosures share the active chart selection. */
export function ReportProfessional({
  view,
  astro,
  vedic,
  highlight,
  selectChart,
}: {
  view: ReadingView;
  astro?: AstroChart;
  vedic?: VedicChart;
  highlight: string;
  selectChart: (section: string, path?: string) => void;
}) {
  const t = useCopy();
  return (
    <section className="report-card professional-view">
      <h2 className="type-h2">{t('report.proView')}</h2>
      {astro ? (
        <>
          <PlanetTable chart={astro} highlight={highlight} onSelect={selectChart} />
          <AspectTable chart={astro} highlight={highlight} onSelect={selectChart} />
          <HouseTable chart={astro} />
        </>
      ) : null}
      {vedic ? (
        <>
          <PlanetTable chart={vedic} highlight={highlight} onSelect={selectChart} />
          <DashaTimeline chart={vedic} nowISO={view.createdAt} all />
        </>
      ) : null}
      {[
        [t('report.school'), view.meta.schoolUsed],
        [t('report.debug'), view.meta.debug],
        [t('report.rawChart'), view.chart],
        [t('report.hits'), view.report.hits],
      ].map(([label, value], i) => (
        <details key={i} open>
          <summary>{String(label)}</summary>
          <ProfessionalData value={value ?? {}} />
        </details>
      ))}
    </section>
  );
}
