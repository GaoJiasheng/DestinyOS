'use client';
import { BaziChartSchema, ZiweiChartSchema } from '@tianji/shared';
import { ZiweiGrid, ZiweiTimeRequired } from '@/components/charts/ziwei-grid';
import { useTranslations } from 'next-intl';
import { useCopy } from '@/i18n/use-copy';
/** Render the saved chart with schema-checked system visuals and shared evidence/section links. */
export function ChartPreview({
  chart,
  highlight,
  onSelect,
  system,
  professional,
}: {
  chart: unknown;
  highlight?: string;
  onSelect?: (section: string) => void;
  system?: string;
  professional?: boolean;
}) {
  const t = useCopy();
  const translations = useTranslations();
  const ziwei = ZiweiChartSchema.safeParse(chart);
  if (ziwei.success)
    return (
      <div id="chart-root" data-highlight={highlight}>
        <ZiweiGrid
          chart={ziwei.data}
          highlight={highlight}
          professional={professional}
          onSelect={onSelect}
        />
      </div>
    );
  if (system === 'ziwei') return <ZiweiTimeRequired />;
  const parsed = BaziChartSchema.safeParse(chart);
  if (!parsed.success)
    return (
      <pre className="technical-data">
        {t('report.content', { text: JSON.stringify(chart, null, 2) })}
      </pre>
    );
  const bazi = parsed.data;
  return (
    <div
      id="chart-root"
      data-highlight={highlight}
      className={highlight ? 'evidence-highlight' : undefined}
    >
      <table className="pillar-table">
        <caption>{t('report.chart')}</caption>
        <thead>
          <tr>
            {(['year', 'month', 'day', 'hour'] as const).map((p) => (
              <th key={p}>{t(`form.birth.${p === 'hour' ? 'hourBranch' : p}`)}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr>
            {(['year', 'month', 'day', 'hour'] as const).map((p) => {
              const pillar = bazi.pillars[p];
              return (
                <td
                  id={`chart-${p}`}
                  className={highlight?.includes(p) ? 'chart-highlight' : ''}
                  key={p}
                >
                  <button
                    type="button"
                    className="pillar-button"
                    onClick={() => onSelect?.(p === 'day' ? 'day_master' : 'overview')}
                  >
                    {pillar ? (
                      <>
                        {translations(`bazi.stems.${pillar.stem}`)}
                        <br />
                        {translations(`bazi.branches.${pillar.branch}`)}
                      </>
                    ) : (
                      t('common.unknown')
                    )}
                  </button>
                </td>
              );
            })}
          </tr>
        </tbody>
      </table>
      <dl className="element-values">
        {Object.entries(bazi.elements.pct).map(([key, value]) => (
          <div key={key}>
            <dt>{translations(`bazi.elements.${key}`)}</dt>
            <dd>{Math.round(value)}%</dd>
          </div>
        ))}
      </dl>
      <p>
        {translations(`bazi.strength.${bazi.strength.level}`)} · {bazi.strength.score.toFixed(1)}
      </p>
      <meter
        min={0}
        max={100}
        value={bazi.strength.score}
        aria-label={translations(`bazi.strength.${bazi.strength.level}`)}
      />
    </div>
  );
}
