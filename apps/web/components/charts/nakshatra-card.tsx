'use client';
import { useTranslations } from 'next-intl';
import type { VedicChart } from '@tianji/shared';
/** Moon mansion card with Pada, ruling graha and explicit local-day uncertainty. */
export function NakshatraCard({
  chart,
  onSelect,
}: {
  chart: VedicChart;
  onSelect?: (section: string, path?: string) => void;
}) {
  const t = useTranslations();
  return (
    <section className="nakshatra-card" aria-label={t('charts.column.nakshatra')}>
      <p className="eyebrow">{t('charts.vedic.moonMansion')}</p>
      <button
        type="button"
        className="nakshatra-title"
        onClick={() => onSelect?.('moon_nakshatra', 'moon.nakshatra')}
      >
        {t(`charts.nakshatra.${chart.moon.nakshatra}`)}
      </button>
      <dl className="element-values">
        <div>
          <dt>{t('charts.column.pada')}</dt>
          <dd>{chart.moon.pada}</dd>
        </div>
        <div>
          <dt>{t('charts.column.ruler')}</dt>
          <dd>{t(`charts.graha.${chart.moon.lord}`)}</dd>
        </div>
        <div>
          <dt>{t('charts.vedic.rashi')}</dt>
          <dd>{t(`charts.sign.${chart.moon.rashi}`)}</dd>
        </div>
      </dl>
      {chart.noonChart ? <p className="notice">{t('charts.vedic.noonMansion')}</p> : null}
      {chart.noonChart && (chart.moon.possibleNakshatras?.length ?? 0) > 1 ? (
        <p role="note">
          {t('charts.vedic.possibleMansions', {
            names: chart.moon
              .possibleNakshatras!.map((n) => t(`charts.nakshatra.${n}`))
              .join(' · '),
          })}
        </p>
      ) : null}
    </section>
  );
}
