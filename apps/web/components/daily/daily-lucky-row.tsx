'use client';
import type { DailyChart } from '@tianji/shared';
import { useTranslations } from 'next-intl';
import { useCopy } from '@/i18n/use-copy';
import { DailyArt } from '@/components/art/daily-art';

/** Five translated lucky indicators with the approved small paintings. */
export function DailyLuckyRow({ bazi }: { bazi: DailyChart['bazi'] }) {
  const t = useCopy(),
    intl = useTranslations();
  return (
    <div className="daily-grid">
      <p>
        <DailyArt kind="lucky-color" alt={t('daily.lucky.color')} />
        <span className="color-dot" style={{ background: bazi.luckyColorHex }} />
        {t('daily.lucky.color')} · {intl(bazi.luckyColor[0]!)}
      </p>
      <p>
        <DailyArt kind="lucky-number" alt={t('daily.lucky.number')} />
        {t('daily.lucky.number')} · {bazi.luckyNumbers.join(' / ')}
      </p>
      <p>
        <DailyArt kind="direction" alt={t('daily.lucky.direction')} />
        {t('daily.lucky.direction')} · {intl(bazi.luckyDirection)}
      </p>
      <p>
        <DailyArt kind="hour" alt={t('daily.lucky.hours')} />
        {t('daily.lucky.hours')} · {bazi.goodHours.map((h) => `${h.from}–${h.to}`).join(' / ')}
      </p>
      <p>
        <DailyArt kind="benefactor" alt={t('daily.lucky.zodiac')} />
        {t('daily.lucky.zodiac')} ·{' '}
        {bazi.nobleZodiac.map((b) => intl(`daily.zodiac.${b}`)).join(' / ')}
      </p>
    </div>
  );
}
