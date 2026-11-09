'use client';
import { useState } from 'react';
import dynamic from 'next/dynamic';
import type { Locale } from '@tianji/shared';
import { Button } from '@/components/ui/button';
import { useCopy } from '@/i18n/use-copy';
import { Link } from '@/i18n/navigation';
import type { PeriodKind } from '@/lib/daily-period';
// DESIGN-GAP: Week and month charts load on the first tap so the daily page's initial JS does not carry them.
const DailyPeriodView = dynamic(
  () => import('./daily-period-view').then((module) => module.DailyPeriodView),
  { ssr: false, loading: () => <div className="daily-period-skeleton skeleton-gold" /> },
);
/** Week/month toggles and the lazily loaded trend panel; example visitors are invited to add a birth profile instead. */
export function DailyPeriodSection({
  date,
  zone,
  signedIn,
  profileId,
  locale,
  example,
}: {
  date: string;
  zone: string | null;
  signedIn: boolean;
  profileId?: string;
  locale: Locale;
  example: boolean;
}) {
  const t = useCopy();
  const [kind, setKind] = useState<PeriodKind | null>(null);
  return (
    <section className="report-card" data-daily-block="11">
      <h2>{t('daily.period')}</h2>
      <div className="action-row">
        {(['week', 'month'] as const).map((value) => (
          <Button
            key={value}
            variant={kind === value ? undefined : 'ghost'}
            aria-pressed={kind === value}
            disabled={example}
            onClick={() => setKind(kind === value ? null : value)}
          >
            {t(`daily.${value}`)}
          </Button>
        ))}
      </div>
      {example ? (
        <p>
          <Link href="/me/birth" className="text-link">
            {t('dailyPeriod.guide')}
          </Link>
        </p>
      ) : null}
      {!example && kind && zone ? (
        <DailyPeriodView
          kind={kind}
          date={date}
          tz={zone}
          signedIn={signedIn}
          profileId={profileId}
          locale={locale}
        />
      ) : null}
    </section>
  );
}
