'use client';
import { useState } from 'react';
import { useTranslations, useFormatter } from 'next-intl';
import type { VedicChart, Graha } from '@tianji/shared';
const COLORS: Record<Graha, string> = {
  surya: 'var(--element-fire)',
  chandra: 'var(--text-2)',
  mangala: 'var(--danger)',
  budha: 'var(--success)',
  guru: 'var(--gold)',
  shukra: 'var(--element-air)',
  shani: 'var(--info)',
  rahu: 'var(--accent)',
  ketu: 'var(--warning)',
};
/** Proportional Mahadasha timeline and expandable Antardasha, anchored to the report's calculation instant. */
export function DashaTimeline({
  chart,
  nowISO,
  all = false,
  onSelect,
}: {
  chart: VedicChart;
  nowISO: string;
  all?: boolean;
  onSelect?: (section: string, path?: string) => void;
}) {
  const t = useTranslations(),
    format = useFormatter();
  const sequence = chart.dasha.sequence;
  const [selected, setSelected] = useState(
    chart.noonChart ? -1 : sequence.findIndex((p) => p.current),
  );
  const from = Date.parse(sequence[0]?.from ?? nowISO),
    to = Date.parse(sequence.at(-1)?.to ?? nowISO);
  const total = to - from;
  const instant = Date.parse(nowISO);
  const date = (iso: string) =>
    format.dateTime(new Date(iso), {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      timeZone: 'UTC',
    });
  // DESIGN-GAP: Timeline pointer represents the immutable report calculation date, rather than changing silently with the browser clock.
  const pointer =
    !chart.noonChart && total > 0 && instant >= from && instant < to
      ? ((instant - from) / total) * 100
      : null;
  return (
    <section className="dasha-timeline" aria-label={t('charts.vedic.dasha')}>
      <h3>{t('charts.vedic.dasha')}</h3>
      {chart.noonChart ? <p className="notice">{t('charts.vedic.noonDasha')}</p> : null}
      {sequence.length ? (
        <>
          <div className="dasha-scroll">
            <div className="dasha-track">
              {sequence.map((period, i) => (
                <button
                  type="button"
                  key={period.from}
                  style={{
                    flexGrow:
                      total > 0 ? (Date.parse(period.to) - Date.parse(period.from)) / total : 1,
                    borderColor: COLORS[period.lord],
                    background: `linear-gradient(180deg, color-mix(in srgb, ${COLORS[period.lord]} 28%, var(--surface-1)), var(--surface-1))`,
                  }}
                  aria-expanded={all || selected === i}
                  aria-controls={`antar-${all ? 'all' : 'chart'}-${i}`}
                  aria-current={period.current && !chart.noonChart ? 'date' : undefined}
                  onClick={() => {
                    setSelected(selected === i ? -1 : i);
                    onSelect?.('dasha', `dasha.sequence.${i}`);
                  }}
                >
                  {t(`charts.graha.${period.lord}`)}
                  <small>
                    {new Date(period.from).getUTCFullYear()}–{new Date(period.to).getUTCFullYear()}
                  </small>
                </button>
              ))}
              {pointer !== null ? (
                <span
                  className="dasha-pointer"
                  style={{ left: `${pointer}%` }}
                  role="img"
                  aria-label={t('charts.vedic.asOf', { date: date(nowISO) })}
                />
              ) : null}
            </div>
          </div>
          <p className="muted">{t('charts.vedic.asOf', { date: date(nowISO) })}</p>
          {sequence.map((period, i) =>
            all || selected === i ? (
              <div
                key={period.from}
                id={`antar-${all ? 'all' : 'chart'}-${i}`}
                className="technical-table-wrap antar-table"
                tabIndex={0}
              >
                <table className="technical-table">
                  <caption>
                    {t('charts.vedic.antarTitle', { lord: t(`charts.graha.${period.lord}`) })} ·{' '}
                    {date(period.from)}–{date(period.to)}
                  </caption>
                  <thead>
                    <tr>
                      <th>{t('charts.column.ruler')}</th>
                      <th>{t('charts.column.from')}</th>
                      <th>{t('charts.column.to')}</th>
                      <th>{t('charts.column.status')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {period.antar.map((antar) => (
                      <tr
                        key={antar.from}
                        aria-current={antar.current && !chart.noonChart ? 'date' : undefined}
                      >
                        <th scope="row">{t(`charts.graha.${antar.lord}`)}</th>
                        <td>{date(antar.from)}</td>
                        <td>{date(antar.to)}</td>
                        <td>
                          {antar.current && !chart.noonChart
                            ? t('charts.vedic.current')
                            : t('charts.unavailable')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null,
          )}
        </>
      ) : (
        <p>{t('charts.vedic.noDasha')}</p>
      )}
    </section>
  );
}
