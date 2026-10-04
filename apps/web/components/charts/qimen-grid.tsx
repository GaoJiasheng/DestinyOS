'use client';
import { useState } from 'react';
import type { QimenChart } from '@tianji/shared';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { QimenCompass } from './qimen-compass';
/** Traditional south-up Lo Shu chart with four lighting layers and category-specific use-god labels. */
export function QimenGrid({
  chart,
  animate = false,
  onSelect,
}: {
  chart: QimenChart;
  animate?: boolean;
  onSelect?: (section: string) => void;
}) {
  const t = useTranslations('divination');
  const b = useTranslations('bazi');
  const [northUp, setNorthUp] = useState(false);
  const order = northUp ? [6, 1, 8, 7, 5, 3, 2, 9, 4] : [4, 9, 2, 3, 5, 7, 8, 1, 6];
  return (
    <div data-testid="qimen-chart">
      <Button variant="secondary" aria-pressed={northUp} onClick={() => setNorthUp((v) => !v)}>
        {t(northUp ? 'northUp' : 'southUp')}
      </Button>
      <div className={`qimen-grid ${animate ? 'qimen-enter' : ''}`}>
        {order.map((index, i) => {
          const p = chart.palaces.find((p) => p.index === index)!;
          const gods = chart.useGods.filter((g) => g.palaceIndex === index);
          return (
            <button
              type="button"
              id={`chart-palace-${index}`}
              key={index}
              className={`qimen-palace ${gods.length ? 'use-god-palace' : ''}`}
              onClick={() => onSelect?.('use_gods')}
              aria-label={t('palaceLabel', {
                number: index,
                direction: t(`directions.${p.direction}`),
              })}
            >
              <small>
                {index} · {t(`directions.${p.direction}`)}
              </small>
              {index === 5 ? (
                <>
                  <strong>{t('ju', { dun: t(chart.dun), ju: chart.ju })}</strong>
                  <small>
                    {t('zhiFu')} · {t(`symbols.${chart.zhiFu.star}`)}
                  </small>
                  <small>
                    {t('zhiShi')} · {t(`symbols.${chart.zhiShi.gate}`)}
                  </small>
                </>
              ) : (
                <>
                  <span className="qimen-layer" style={{ animationDelay: `${900 + i * 20}ms` }}>
                    {p.deity ? t(`symbols.${p.deity}`) : '—'}
                  </span>
                  <strong className="qimen-layer" style={{ animationDelay: `${300 + i * 20}ms` }}>
                    {t(`symbols.${p.star}`)} · {b(`stems.${p.skyStem}`)}
                  </strong>
                  <span className="qimen-layer" style={{ animationDelay: `${600 + i * 20}ms` }}>
                    {p.gate ? t(`symbols.${p.gate}`) : '—'}
                  </span>
                  <span className="qimen-layer" style={{ animationDelay: `${i * 20}ms` }}>
                    {t('earth')} · {b(`stems.${p.earthStem}`)}
                    {p.hiddenStem ? ` / ${b(`stems.${p.hiddenStem}`)}` : ''}
                  </span>
                </>
              )}
              {gods.map((g) => (
                <span className="use-god-label" key={g.key}>
                  {t('godHere', { god: t(`symbols.${g.key}`) })}
                </span>
              ))}
              <small>{p.flags.map((f) => t(`flags.${f}`)).join(' · ')}</small>
            </button>
          );
        })}
      </div>
      <QimenCompass favorableDirections={chart.favorableDirections} northUp={northUp} />
    </div>
  );
}
