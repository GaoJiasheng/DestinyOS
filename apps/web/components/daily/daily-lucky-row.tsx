'use client';
import type { DailyChart } from '@tianji/shared';
import { useTranslations } from 'next-intl';
import { useCopy } from '@/i18n/use-copy';
import { DailyArt } from '@/components/art/daily-art';

/** Five translated lucky indicators with the approved small paintings. */
export function DailyLuckyRow({ bazi }: { bazi: DailyChart['bazi'] }) {
  const t = useCopy(),
    intl = useTranslations();
  // Label/value pairs share one two-column grid so long values never wrap under a centered label.
  const rows = [
    {
      kind: 'lucky-color',
      label: t('daily.lucky.color'),
      value: (
        <>
          <span className="color-dot" style={{ background: bazi.luckyColorHex }} aria-hidden />
          {intl(bazi.luckyColor[0]!)}
        </>
      ),
    },
    { kind: 'lucky-number', label: t('daily.lucky.number'), value: bazi.luckyNumbers.join(' / ') },
    { kind: 'direction', label: t('daily.lucky.direction'), value: intl(bazi.luckyDirection) },
    {
      kind: 'hour',
      label: t('daily.lucky.hours'),
      value: bazi.goodHours.map((h) => `${h.from}–${h.to}`).join(' / '),
    },
    {
      kind: 'benefactor',
      label: t('daily.lucky.zodiac'),
      value: bazi.nobleZodiac.map((b) => intl(`daily.zodiac.${b}`)).join(' / '),
    },
  ] as const;
  return (
    <dl className="daily-lucky">
      {rows.map((row) => (
        <div key={row.kind}>
          <dt>
            <DailyArt kind={row.kind} alt="" />
            {row.label}
          </dt>
          <dd>{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}
