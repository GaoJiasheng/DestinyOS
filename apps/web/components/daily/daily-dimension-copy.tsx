'use client';
import { useTranslations } from 'next-intl';
import type { DailyChart, Locale } from '@tianji/shared';
import {
  dailyDimensionCopy,
  dailySkyParagraph,
  type DailyDimension,
} from '@tianji/ui-core/daily-drivers';
import { Link } from '@/i18n/navigation';

export const moonPhaseEmoji: Record<string, string> = {
  new_moon: '🌑',
  waxing_crescent: '🌒',
  first_quarter: '🌓',
  waxing_gibbous: '🌔',
  full_moon: '🌕',
  waning_gibbous: '🌖',
  last_quarter: '🌗',
  waning_crescent: '🌘',
};
/** Trigger-aware copy for a dimension; null means an older report without score drivers. */
export function useDimensionCopy(chart: DailyChart | undefined, locale: Locale) {
  const t = useTranslations();
  return (dim: DailyDimension) => (chart ? dailyDimensionCopy(chart, dim, locale, t) : null);
}
/** Plain reading of today's Moon with the sign linked to its encyclopedia page. */
export function DailySkyNote({ chart, locale }: { chart: DailyChart; locale: Locale }) {
  const t = useTranslations();
  return (
    <>
      <p>{dailySkyParagraph(chart, locale, t)}</p>
      <p>
        <Link href={`/learn/glossary/sign.${chart.astro.moonSign}`} className="text-link">
          {t('dailySky.learn', { sign: t(`charts.sign.${chart.astro.moonSign}`) })}
        </Link>
      </p>
    </>
  );
}
