'use client';
import {
  NumerologyChartSchema,
  BaziChartSchema,
  ZiweiChartSchema,
  IchingChartSchema,
  QimenChartSchema,
  AstroChartSchema,
  VedicChartSchema,
  TarotChartSchema,
} from '@tianji/shared';
import { NumerologyChart } from '@/components/charts/numerology-chart';
import { ZiweiGrid, ZiweiTimeRequired } from '@/components/charts/ziwei-grid';
import { DivinationChart } from '@/components/charts/divination-chart';
import { SpreadLayout } from '@/components/tarot/spread-layout';
import { NatalWheel } from '../charts/natal-wheel';
import { VedicSouthChart } from '../charts/vedic-south-chart';
import { useCopy } from '@/i18n/use-copy';
import { BaziPillars } from '@/components/charts/bazi-pillars';
import { ElementRing } from '@/components/charts/element-ring';
import { StrengthGauge } from '@/components/charts/strength-gauge';
import { LuckTimeline } from '@/components/charts/luck-timeline';
import { BranchRelationDiagram } from '@/components/charts/branch-relation-diagram';
import { BaziProfessionalTable } from '@/components/charts/bazi-professional-table';
const COMPONENTS = { BaziPillars, ElementRing, StrengthGauge, LuckTimeline, BranchRelationDiagram };
/** Render a validated chart snapshot or the named local visualization referenced by a report block. */
export function ChartPreview({
  chart,
  highlight,
  onSelect,
  system,
  component,
  professional = false,
}: {
  chart: unknown;
  highlight?: string;
  onSelect?: (section: string, path?: string) => void;
  system?: string;
  component?: string;
  professional?: boolean;
}) {
  const t = useCopy();
  const numerology = NumerologyChartSchema.safeParse(chart);
  if (numerology.success)
    return <NumerologyChart chart={numerology.data} highlight={highlight} onSelect={onSelect} />;
  const ziwei = ZiweiChartSchema.safeParse(chart);
  if (ziwei.success)
    return (
      <div
        id="chart-root"
        tabIndex={-1}
        data-highlight={highlight}
        className={highlight ? 'evidence-highlight' : undefined}
      >
        <ZiweiGrid
          chart={ziwei.data}
          highlight={highlight}
          professional={professional}
          onSelect={onSelect}
        />
      </div>
    );
  if (system === 'ziwei') return <ZiweiTimeRequired />;
  const iching = IchingChartSchema.safeParse(chart);
  const qimen = QimenChartSchema.safeParse(chart);
  if (iching.success || qimen.success)
    return (
      <div
        id="chart-root"
        data-highlight={highlight}
        className={highlight ? 'evidence-highlight' : undefined}
      >
        <DivinationChart chart={iching.success ? iching.data : qimen.data!} onSelect={onSelect} />
      </div>
    );
  const tarot = TarotChartSchema.safeParse(chart);
  if (tarot.success)
    return (
      <div
        id="chart-root"
        tabIndex={-1}
        data-highlight={highlight}
        className={highlight ? 'evidence-highlight' : undefined}
      >
        <SpreadLayout spread={tarot.data.spread} cards={tarot.data.cards} highlight={highlight} />
      </div>
    );
  const astro = AstroChartSchema.safeParse(chart);
  const vedic = VedicChartSchema.safeParse(chart);
  if (astro.success)
    return <NatalWheel chart={astro.data} highlight={highlight} onSelect={onSelect} />;
  if (vedic.success)
    return <VedicSouthChart chart={vedic.data} highlight={highlight} onSelect={onSelect} />;
  const parsed = BaziChartSchema.safeParse(chart);
  if (!parsed.success)
    return (
      <pre className="technical-data">
        {t('report.content', { text: JSON.stringify(chart, null, 2) })}
      </pre>
    );
  const props = { chart: parsed.data, highlight, onSelect };
  if (component) {
    const Component = Object.entries(COMPONENTS).find(([name]) => name === component)?.[1];
    return Component ? (
      <Component {...props} />
    ) : (
      <p className="muted">{t('bazi.chart.unavailable')}</p>
    );
  }
  return (
    <div
      id="chart-root"
      tabIndex={-1}
      data-highlight={highlight}
      className={`bazi-chart${highlight ? ' evidence-highlight' : ''}`}
    >
      <BaziPillars {...props} />
      <ElementRing {...props} />
      <StrengthGauge {...props} />
      <LuckTimeline {...props} />
      <BranchRelationDiagram {...props} />
      {professional ? <BaziProfessionalTable {...props} /> : null}
    </div>
  );
}
