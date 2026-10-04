'use client';
import { useTranslations } from 'next-intl';
import type { AstroChart } from '@tianji/shared';
import { aspectColor, bodyFromEvidence } from './astro-geometry';
/** Orb-sorted aspect table with accessible labels in addition to color. */
export function AspectTable({
  chart,
  highlight,
  onSelect,
}: {
  chart: AstroChart;
  highlight?: string;
  onSelect?: (section: string, path?: string) => void;
}) {
  const t = useTranslations();
  const selected = bodyFromEvidence(chart.bodies, highlight);
  return (
    <div className="technical-table-wrap">
      <table className="technical-table aspect-table">
        <caption>{t('charts.aspects')}</caption>
        <thead>
          <tr>
            {['planet', 'aspect', 'planet', 'orb', 'motion'].map((key, i) => (
              <th key={i} scope="col">
                {t(`charts.column.${key}`)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {[...chart.aspects]
            .sort((a, b) => a.orb - b.orb)
            .map((a) => (
              <tr
                key={`${a.a}-${a.b}-${a.type}`}
                className={selected === a.a || selected === a.b ? 'chart-highlight' : undefined}
              >
                <th scope="row">
                  <button
                    type="button"
                    onClick={() =>
                      onSelect?.(
                        'aspects',
                        `bodies.${chart.bodies.findIndex((b) => b.key === a.a)}`,
                      )
                    }
                  >
                    {t(`charts.planet.${a.a}`)}
                  </button>
                </th>
                <td>
                  <span className="aspect-dot" style={{ background: aspectColor(a.type) }} />
                  {t(`charts.aspect.${a.type}`)}
                </td>
                <td>{t(`charts.planet.${a.b}`)}</td>
                <td>{a.orb.toFixed(2)}°</td>
                <td>{t(a.applying ? 'charts.applying' : 'charts.separating')}</td>
              </tr>
            ))}
        </tbody>
      </table>
      {chart.aspects.length === 0 ? <p>{t('charts.noAspects')}</p> : null}
    </div>
  );
}
