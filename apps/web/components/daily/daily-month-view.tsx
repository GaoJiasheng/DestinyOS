'use client';
import { useTranslations } from 'next-intl';
import { Temporal } from '@js-temporal/polyfill';
import type { Locale } from '@tianji/shared';
import { dailyStars, type DailyRangeDay } from '@tianji/engine/daily';
import type { CalendarEvent } from '@tianji/engine/calendar';
import { Link } from '@/i18n/navigation';
import { dayKeyword, heatColors, periodStats } from '@/lib/daily-period';

const KEY_EVENTS: readonly CalendarEvent['kind'][] = [
  'solar_term',
  'new_moon',
  'full_moon',
  'solar_eclipse',
  'lunar_eclipse',
  'retrograde',
  'solar_return',
];
const format = (date: string, locale: Locale, options: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat(locale, { ...options, timeZone: 'UTC' }).format(
    new Date(`${date}T12:00:00Z`),
  );

/** Month heatmap colored by overall score; days open the daily view and key sky dates are dotted. */
export function DailyMonthView({
  days,
  events,
  from,
  today,
  locale,
}: {
  days: DailyRangeDay[];
  events: CalendarEvent[];
  from: string;
  today: string;
  locale: Locale;
}) {
  const t = useTranslations();
  const stats = periodStats(days);
  const key = events.filter(
    (e) => KEY_EVENTS.includes(e.kind) && days.some((d) => d.date === e.date),
  );
  const marked = new Set(key.map((e) => e.date));
  const firstColumn = Temporal.PlainDate.from(from).dayOfWeek - 1;
  const eventLabel = (event: CalendarEvent) => {
    const detail = event.detail
      ? t(
          event.kind === 'solar_term'
            ? `home.term.${event.detail}`
            : `charts.planet.${event.detail}`,
        )
      : '';
    return t(`calendar.event.${event.kind}`, { detail });
  };
  const shortDate = (date: string) => format(date, locale, { month: 'short', day: 'numeric' });
  return (
    <div className="daily-period">
      <h3>{t('dailyPeriod.title.month')}</h3>
      <svg
        viewBox={`0 0 336 ${Math.ceil((firstColumn + days.length) / 7) * 50 + 30}`}
        className="calendar-heatmap"
        role="group"
        aria-label={t('dailyPeriod.heatmap')}
      >
        {Array.from({ length: 7 }, (_, i) => (
          <text
            key={i}
            x={i * 48 + 24}
            y="16"
            textAnchor="middle"
            fill="currentColor"
            fontSize="12"
          >
            {format(`2026-10-${String(5 + i).padStart(2, '0')}`, locale, { weekday: 'short' })}
          </text>
        ))}
        {days.map((day, i) => {
          const cell = i + firstColumn,
            x = (cell % 7) * 48,
            y = Math.floor(cell / 7) * 50 + 26;
          const stars = dailyStars(day.overall);
          const band = stars - 1;
          const word = dayKeyword(day);
          const label = t('dailyPeriod.dayLabel', {
            date: format(day.date, locale, { dateStyle: 'full' }),
            score: Math.round(day.overall),
            stars,
            keyword: word
              ? t(`dailyPeriod.keyword.${word.dim}.${word.dir}`)
              : t('dailyPeriod.steady'),
          });
          return (
            <Link
              key={day.date}
              href={{ pathname: '/today', query: { date: day.date } }}
              aria-label={label}
              data-calendar-day={day.date}
            >
              <title>{label}</title>
              <rect
                x={x + 1}
                y={y}
                width="46"
                height="46"
                rx="8"
                fill={heatColors[band]}
                stroke={day.date === today ? 'var(--text-1)' : 'none'}
                strokeWidth="1.5"
              />
              <text
                x={x + 24}
                y={y + 20}
                textAnchor="middle"
                fill={band >= 2 ? 'var(--bg-0)' : 'var(--text-1)'}
                fontSize="14"
              >
                {i + 1}
              </text>
              <text
                x={x + 24}
                y={y + 36}
                textAnchor="middle"
                fill={band >= 2 ? 'var(--bg-0)' : 'var(--text-1)'}
                fontSize="11"
              >
                {Math.round(day.overall)}
              </text>
              {marked.has(day.date) ? (
                <circle
                  cx={x + 39}
                  cy={y + 8}
                  r="3.5"
                  fill={band >= 2 ? 'var(--bg-0)' : 'var(--gold)'}
                />
              ) : null}
            </Link>
          );
        })}
      </svg>
      <p>
        {t('dailyPeriod.month.summary.1', {
          avg: stats.avg,
          good: stats.good,
          low: stats.low,
        })}{' '}
        {t('dailyPeriod.month.summary.2', {
          best: shortDate(stats.best.date),
          watch: shortDate(stats.watch.date),
        })}
      </p>
      <p>
        {t('dailyPeriod.month.summary.3', {
          strong: t(`daily.dimension.${stats.strong}`),
          weak: t(`daily.dimension.${stats.weak}`),
        })}
        {key.length ? <> {t('dailyPeriod.month.summary.events', { count: key.length })}</> : null}
      </p>
      {key.length ? (
        <>
          <h4>{t('dailyPeriod.events')}</h4>
          <ul className="daily-period-events">
            {key.map((event) => (
              <li key={`${event.kind}:${event.at}`} data-calendar-event={event.kind}>
                <Link
                  href={{ pathname: '/today', query: { date: event.date } }}
                  className="text-link"
                >
                  <time dateTime={event.date}>{shortDate(event.date)}</time> · {eventLabel(event)}
                </Link>
              </li>
            ))}
          </ul>
        </>
      ) : null}
      <Link href="/today/calendar" className="text-link">
        {t('dailyPeriod.fullCalendar')}
      </Link>
    </div>
  );
}
