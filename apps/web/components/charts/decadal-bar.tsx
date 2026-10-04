'use client';
import type { ZiweiChart } from '@tianji/shared';
import { useTranslations } from 'next-intl';
/** Chronological decade controls use engine ranges and highlight only the engine's current decade. */
export function DecadalBar({
  chart,
  selected,
  onSelect,
}: {
  chart: ZiweiChart;
  selected: number;
  onSelect: (index: number) => void;
}) {
  const t = useTranslations('ziwei.chart');
  const current = chart.horoscope.decadal;
  const childhood = current.fromAge < chart.basics.fiveElementsClass.number;
  return (
    <div className="ziwei-decadal">
      <h3>{t('decadal')}</h3>
      {childhood ? <p>{t('childhood', { from: current.fromAge, to: current.toAge })}</p> : null}
      <div className="ziwei-decadal-scroll" role="group" aria-label={t('decadal')}>
        {[...chart.palaces]
          .sort((a, b) => a.decadal.fromAge - b.decadal.fromAge)
          .map((p) => (
            <button
              type="button"
              key={p.index}
              aria-pressed={selected === p.index}
              data-current={!childhood && p.index === current.palaceIndex}
              onClick={() => onSelect(p.index)}
            >
              <span>{t(`palace.${p.key}`)}</span>
              <strong>{t('ageRange', { from: p.decadal.fromAge, to: p.decadal.toAge })}</strong>
              <small>{t('yearRange', { from: p.decadal.fromYear, to: p.decadal.toYear })}</small>
              {!childhood && p.index === current.palaceIndex ? <span>{t('current')}</span> : null}
            </button>
          ))}
      </div>
    </div>
  );
}
