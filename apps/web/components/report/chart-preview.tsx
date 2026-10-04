'use client';
import { BaziChartSchema } from '@tianji/shared';
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
  component,
  professional = false,
}: {
  chart: unknown;
  highlight?: string;
  onSelect?: (path: string) => void;
  component?: string;
  professional?: boolean;
}) {
  const t = useCopy();
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
