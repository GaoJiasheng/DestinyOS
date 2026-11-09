'use client';
import type { Locale } from '@tianji/shared';
import { useCopy } from '@/i18n/use-copy';
import { Link } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';
import type { PeriodKind } from '@/lib/daily-period';
import { DailyWeekView } from './daily-week-view';
import { DailyMonthView } from './daily-month-view';
import { useDailyRange } from './use-daily-range';

/** Loads range scores on demand and renders a skeleton, an error, a birth-profile prompt or the chosen trend. */
export function DailyPeriodView({
  kind,
  date,
  tz,
  signedIn,
  profileId,
  locale,
}: {
  kind: PeriodKind;
  date: string;
  tz: string;
  signedIn: boolean;
  profileId?: string;
  locale: Locale;
}) {
  const t = useCopy();
  const state = useDailyRange({ kind, date, tz, signedIn, profileId, locale });
  if (state.status === 'loading')
    return (
      <div className="daily-period-skeleton skeleton-gold" role="status" aria-busy="true">
        <span className="sr-only">{t('dailyPeriod.loading')}</span>
      </div>
    );
  if (state.status === 'error')
    return (
      <div role="alert">
        {t('dailyPeriod.error')} <Button onClick={state.retry}>{t('common.retry')}</Button>
      </div>
    );
  if (state.status === 'guide')
    return (
      <p>
        <Link href="/me/birth" className="text-link">
          {t('dailyPeriod.guide')}
        </Link>
      </p>
    );
  return kind === 'week' ? (
    <DailyWeekView days={state.result.days} today={date} locale={locale} />
  ) : (
    <DailyMonthView
      days={state.result.days}
      events={state.result.events}
      from={state.from}
      today={date}
      locale={locale}
    />
  );
}
