'use client';
import { useTranslations } from 'next-intl';
import type { Locale } from '@tianji/shared';
import { dailyStars, type DailyRangeDay } from '@tianji/engine/daily';
import { Link } from '@/i18n/navigation';
import { dayKeyword, periodStats } from '@/lib/daily-period';

const format = (date: string, locale: Locale, options: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat(locale, { ...options, timeZone: 'UTC' }).format(
    new Date(`${date}T12:00:00Z`),
  );

/** Seven-day overall trend with keywords, marking the strongest and most delicate day. */
export function DailyWeekView({
  days,
  today,
  locale,
}: {
  days: DailyRangeDay[];
  today: string;
  locale: Locale;
}) {
  const t = useTranslations();
  const stats = periodStats(days);
  const weekday = (date: string) => format(date, locale, { weekday: 'short' });
  const points = days.map((day, i) => ({
    x: 16 + i * 38,
    y: 62 - ((Math.max(30, Math.min(90, day.overall)) - 30) * 52) / 60,
    day,
  }));
  const keyword = (day: DailyRangeDay) => {
    const word = dayKeyword(day);
    return word ? t(`dailyPeriod.keyword.${word.dim}.${word.dir}`) : t('dailyPeriod.steady');
  };
  return (
    <div className="daily-period">
      <h3>{t('dailyPeriod.title.week')}</h3>
      <svg
        viewBox="0 0 260 70"
        role="img"
        aria-label={t('dailyPeriod.trend')}
        className="daily-week-trend"
      >
        <polyline
          points={points.map((p) => `${p.x},${p.y}`).join(' ')}
          fill="none"
          stroke="var(--gold)"
          strokeWidth="1.5"
        />
        {points.map((p) => (
          <circle
            key={p.day.date}
            cx={p.x}
            cy={p.y}
            r={p.day.date === today ? 4 : 3}
            fill="var(--gold)"
          />
        ))}
      </svg>
      <ol className="daily-week-list">
        {days.map((day) => {
          const stars = dailyStars(day.overall);
          return (
            <li key={day.date} data-today={day.date === today || undefined}>
              <Link href={{ pathname: '/today', query: { date: day.date } }}>
                <span className="daily-week-day">{weekday(day.date)}</span>
                <span
                  className="daily-week-bar"
                  style={{ width: `${Math.max(12, day.overall)}%` }}
                  aria-hidden
                />
                <span className="daily-week-score">
                  {'★'.repeat(stars)}
                  <small> {Math.round(day.overall)}</small>
                </span>
                <span className="daily-week-word">{keyword(day)}</span>
                {day.date === stats.best.date ? (
                  <span className="daily-badge">{t('dailyPeriod.best')}</span>
                ) : day.date === stats.watch.date ? (
                  <span className="daily-badge daily-badge-watch">{t('dailyPeriod.watch')}</span>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ol>
      <p>
        {t('dailyPeriod.week.summary.1', {
          tone: t(
            stats.avg >= 70
              ? 'dailyPeriod.tone.good'
              : stats.avg >= 55
                ? 'dailyPeriod.tone.mixed'
                : 'dailyPeriod.tone.low',
          ),
          avg: stats.avg,
          best: weekday(stats.best.date),
          watch: weekday(stats.watch.date),
        })}
      </p>
      <p>
        {t('dailyPeriod.week.summary.2', {
          strong: t(`daily.dimension.${stats.strong}`),
          weak: t(`daily.dimension.${stats.weak}`),
        })}{' '}
        {t('dailyPeriod.week.summary.3', {
          best: weekday(stats.best.date),
          watch: weekday(stats.watch.date),
        })}
      </p>
    </div>
  );
}
