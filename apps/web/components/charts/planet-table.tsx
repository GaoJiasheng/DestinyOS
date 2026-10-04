'use client';
import { useTranslations } from 'next-intl';
import type { AstroChart, VedicChart } from '@tianji/shared';
import { bodyFromEvidence } from './astro-geometry';
/** Localized western or Vedic positions/statuses; never invent house numbers for noon charts. */
export function PlanetTable({
  chart,
  highlight,
  onSelect,
}: {
  chart: AstroChart | VedicChart;
  highlight?: string;
  onSelect?: (section: string, path?: string) => void;
}) {
  const t = useTranslations();
  const vedic = 'ayanamsa' in chart;
  const selected = bodyFromEvidence(chart.bodies, highlight);
  return (
    <div className="technical-table-wrap">
      <table className="technical-table planet-table">
        <caption>{t('charts.planets')}</caption>
        <thead>
          <tr>
            {[
              'planet',
              'sign',
              'degree',
              'house',
              'status',
              ...(vedic ? ['nakshatra', 'pada', 'dignity', 'navamsa'] : []),
            ].map((key) => (
              <th key={key} scope="col">
                {t(`charts.column.${key}`)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {chart.bodies.map((body, i) => (
            <tr
              key={body.key}
              data-body={body.key}
              className={selected === body.key ? 'chart-highlight' : undefined}
            >
              <th scope="row">
                <button
                  type="button"
                  onClick={() =>
                    onSelect?.(
                      vedic
                        ? 'lagna_planets'
                        : body.key === 'sun' || body.key === 'moon'
                          ? 'big_three'
                          : 'planets',
                      `bodies.${i}`,
                    )
                  }
                >
                  {t(`charts.${vedic ? 'graha' : 'planet'}.${body.key}`)}
                </button>
              </th>
              <td>{t(`charts.sign.${body.sign}`)}</td>
              <td>{body.degInSign.toFixed(2)}°</td>
              <td>
                {!chart.noonChart && body.house !== null ? body.house : t('charts.unavailable')}
              </td>
              <td>
                {[
                  body.retro ? t('charts.retrograde') : t('charts.direct'),
                  ...('combust' in body && body.combust ? [t('charts.combust')] : []),
                  ...('approximate' in body && body.approximate ? [t('charts.approximate')] : []),
                  ...('uncertaintyDegrees' in body && body.uncertaintyDegrees
                    ? [t('charts.uncertainty', { degrees: body.uncertaintyDegrees })]
                    : []),
                ].join(' · ')}
              </td>
              {'nakshatra' in body ? (
                <>
                  <td>{t(`charts.nakshatra.${body.nakshatra}`)}</td>
                  <td>{body.pada}</td>
                  <td>{t(`charts.dignity.${body.dignity}`)}</td>
                  <td>{t(`charts.sign.${body.navamsaSign}`)}</td>
                </>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
/** Twelve western cusps and rulers for the technical view, using the active house system. */
export function HouseTable({ chart }: { chart: AstroChart }) {
  const t = useTranslations();
  if (chart.noonChart || !chart.houses) return <p>{t('charts.noHouses')}</p>;
  return (
    <div className="technical-table-wrap">
      <table className="technical-table">
        <caption>{t('charts.houses')}</caption>
        <thead>
          <tr>
            {['house', 'sign', 'degree', 'ruler'].map((key) => (
              <th key={key}>{t(`charts.column.${key}`)}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {chart.houses.map((h) => (
            <tr key={h.index}>
              <th scope="row">{h.index}</th>
              <td>{t(`charts.sign.${h.sign}`)}</td>
              <td>{(h.cusp % 30).toFixed(2)}°</td>
              <td>{t(`charts.planet.${h.ruler}`)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
