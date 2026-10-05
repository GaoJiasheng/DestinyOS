'use client';
import { useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Temporal } from '@js-temporal/polyfill';
import type { Locale } from '@tianji/shared';
import type { DailyRangeDay } from '@tianji/engine/daily';
import type { CalendarEvent } from '@tianji/engine/calendar';
import { getDailyRangeAction, getCalendarYearAction } from '@/app/today/actions';
import { readAnonymous } from '@/lib/anonymous-storage';
import { localToday } from '@/lib/daily-date';
import { Link } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';
// DESIGN-GAP: B-06 omits shades and copy keys; the calendar namespace and five gold steps use the existing daily star thresholds.
const gold = ['#3d301d', '#69502a', '#997139', '#c69b52', '#f0cf80'];
/** SVG month grid with keyboard-accessible day links and non-color score labels. */
export function CalendarView({
  signedIn,
  tz,
  timeUnknown = false,
}: {
  signedIn: boolean;
  tz?: string | null;
  timeUnknown?: boolean;
}) {
  const t = useTranslations(),
    locale = useLocale() as Locale;
  const [zone, setZone] = useState<string | null>(tz ?? null),
    [month, setMonth] = useState<string | null>(null);
  const [days, setDays] = useState<DailyRangeDay[]>([]),
    [events, setEvents] = useState<CalendarEvent[]>([]);
  const [busy, setBusy] = useState(true),
    [yearBusy, setYearBusy] = useState(true),
    [error, setError] = useState<string | null>(null),
    [yearError, setYearError] = useState(false),
    [missing, setMissing] = useState(false),
    [unknownTime, setUnknownTime] = useState(timeUnknown),
    [retry, setRetry] = useState(0);
  useEffect(() => {
    const selected =
      tz ?? localStorage.getItem('tianji-tz') ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
    setZone(selected);
    setMonth(localToday(selected).slice(0, 7));
  }, [tz]);
  const year = month ? Number(month.slice(0, 4)) : null;
  useEffect(() => {
    if (!zone || !month) return;
    let active = true;
    setBusy(true);
    setError(null);
    setDays([]);
    setMissing(false);
    void (async () => {
      const start = Temporal.PlainDate.from(`${month}-01`),
        to = start.with({ day: start.daysInMonth }).toString();
      if (signedIn) {
        const result = await getDailyRangeAction({ from: start.toString(), to, tz: zone, locale });
        if (!result.ok) {
          if (result.error.code === 'E_PROFILE_REQUIRED') {
            if (active) setMissing(true);
            return;
          }
          throw new Error(result.error.code);
        }
        if (active) setDays(result.data);
      } else {
        const device = await readAnonymous();
        if (!device?.profile) {
          if (active) setMissing(true);
          return;
        }
        const { computeDailyRange } = await import('@tianji/engine/daily');
        const result = computeDailyRange(
          device.profile,
          start.toString(),
          to,
          zone,
          device.anonId,
          locale,
        );
        if (active) {
          setDays(result);
          setUnknownTime(device.profile.timeUnknown);
        }
      }
    })()
      .catch(() => {
        if (active) setError('report.error.E_INTERNAL');
      })
      .finally(() => {
        if (active) setBusy(false);
      });
    return () => {
      active = false;
    };
  }, [signedIn, zone, month, locale, retry]);
  useEffect(() => {
    if (!zone || year === null) return;
    let active = true;
    setYearBusy(true);
    setYearError(false);
    setEvents([]);
    void (async () => {
      if (signedIn) {
        const result = await getCalendarYearAction({ year, tz: zone, locale });
        if (!result.ok) {
          if (result.error.code === 'E_PROFILE_REQUIRED') return;
          throw new Error(result.error.code);
        }
        if (active) setEvents(result.data);
      } else {
        const device = await readAnonymous();
        if (!device?.profile) return;
        const { computeCalendarYear } = await import('@tianji/engine/calendar');
        const result = computeCalendarYear(device.profile, year, zone, locale);
        if (active) setEvents(result);
      }
    })()
      .catch(() => {
        if (active) setYearError(true);
      })
      .finally(() => {
        if (active) setYearBusy(false);
      });
    return () => {
      active = false;
    };
  }, [signedIn, zone, year, locale, retry]);
  const formatDate = (date: string, options: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat(locale, { ...options, timeZone: 'UTC' }).format(
      new Date(`${date}T12:00:00Z`),
    );
  function switchMonth(amount: number) {
    if (month)
      setMonth(
        Temporal.PlainDate.from(`${month}-01`).add({ months: amount }).toString().slice(0, 7),
      );
  }
  return (
    <article className="daily-page calendar-page">
      <header>
        <h1 className="type-h1">{t('calendar.title')}</h1>
        <Link href="/today" className="text-link">
          {t('nav.today')}
        </Link>
      </header>
      <section className="report-card" aria-busy={busy}>
        <nav className="action-row" aria-label={t('calendar.monthNav')}>
          <Button
            variant="ghost"
            disabled={!month || month === '1900-01'}
            onClick={() => switchMonth(-1)}
          >
            {t('calendar.previous')}
          </Button>
          <h2 aria-live="polite">
            {month
              ? formatDate(`${month}-01`, { year: 'numeric', month: 'long' })
              : t('common.loading')}
          </h2>
          <Button
            variant="ghost"
            disabled={!month || month === '2100-12'}
            onClick={() => switchMonth(1)}
          >
            {t('calendar.next')}
          </Button>
        </nav>
        {zone ? <p>{t('calendar.zone', { zone })}</p> : null}
        {busy ? <p role="status">{t('common.loading')}</p> : null}
        {missing ? (
          <p>
            {t('calendar.profileRequired')}{' '}
            <Link href="/me/birth" className="text-link">
              {t('daily.profileCTA')}
            </Link>
          </p>
        ) : null}
        {error ? (
          <div role="alert">
            {t(error)} <Button onClick={() => setRetry((n) => n + 1)}>{t('common.retry')}</Button>
          </div>
        ) : null}
        {days.length && month ? (
          <>
            <svg
              viewBox="0 0 350 338"
              className="calendar-heatmap"
              role="group"
              aria-label={t('calendar.heatmap')}
            >
              {Array.from({ length: 7 }, (_, i) => (
                <text
                  key={i}
                  x={i * 50 + 25}
                  y="20"
                  textAnchor="middle"
                  fill="currentColor"
                  fontSize="12"
                >
                  {formatDate(`2026-10-${String(5 + i).padStart(2, '0')}`, { weekday: 'short' })}
                </text>
              ))}
              {days.map((day, i) => {
                const cell = i + Temporal.PlainDate.from(`${month}-01`).dayOfWeek - 1,
                  x = (cell % 7) * 50,
                  y = Math.floor(cell / 7) * 50 + 32;
                const band =
                  day.overall >= 85
                    ? 4
                    : day.overall >= 70
                      ? 3
                      : day.overall >= 55
                        ? 2
                        : day.overall >= 40
                          ? 1
                          : 0;
                const label = t('calendar.dayLabel', {
                  date: formatDate(day.date, { dateStyle: 'full' }),
                  score: day.overall,
                });
                return (
                  <Link
                    key={day.date}
                    href={{ pathname: '/today', query: { date: day.date } }}
                    aria-label={label}
                    data-calendar-day={day.date}
                  >
                    <title>{label}</title>
                    <rect x={x + 2} y={y} width="46" height="46" rx="8" fill={gold[band]} />
                    <text
                      x={x + 25}
                      y={y + 20}
                      textAnchor="middle"
                      fill={band >= 2 ? '#17130d' : '#fff5dc'}
                      fontSize="14"
                    >
                      {i + 1}
                    </text>
                    <text
                      x={x + 25}
                      y={y + 36}
                      textAnchor="middle"
                      fill={band >= 2 ? '#17130d' : '#fff5dc'}
                      fontSize="11"
                    >
                      {day.overall}
                    </text>
                  </Link>
                );
              })}
            </svg>
            <div className="calendar-legend">
              {gold.map((color, i) => (
                <span key={color}>
                  <svg width="16" height="16" aria-hidden>
                    <rect width="16" height="16" rx="3" fill={color} />
                  </svg>
                  {t(`daily.rating.${i + 1}`)}
                </span>
              ))}
            </div>
          </>
        ) : null}
      </section>
      {!missing ? (
        <section className="report-card" aria-busy={yearBusy}>
          <h2>{t('calendar.annual', { year: year ?? '' })}</h2>
          <p>{t('calendar.boundaries')}</p>
          {unknownTime ? <p>{t('calendar.unknownTime')}</p> : null}
          {yearBusy ? <p role="status">{t('common.loading')}</p> : null}
          {yearError ? (
            <div role="alert">
              {t('report.error.E_INTERNAL')}{' '}
              <Button onClick={() => setRetry((n) => n + 1)}>{t('common.retry')}</Button>
            </div>
          ) : null}
          {!yearBusy && !yearError && !events.length ? <p>{t('calendar.empty')}</p> : null}
          <ul className="calendar-events">
            {events.map((event) => {
              const detail = event.detail
                ? t(
                    event.kind === 'solar_term'
                      ? `home.term.${event.detail}`
                      : event.kind === 'retrograde'
                        ? `charts.planet.${event.detail}`
                        : `charts.graha.${event.detail}`,
                  )
                : '';
              return (
                <li key={`${event.kind}:${event.at}`} data-calendar-event={event.kind}>
                  <Link
                    href={{
                      pathname: '/today',
                      query: { date: event.date < `${year}-01-01` ? `${year}-01-01` : event.date },
                    }}
                    className="text-link"
                  >
                    <time dateTime={event.at}>
                      {formatDate(event.date, { month: 'short', day: 'numeric' })}
                    </time>
                    {event.endDate
                      ? t('calendar.interval', {
                          end: formatDate(event.endDate, {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                          }),
                        })
                      : null}{' '}
                    · {t(`calendar.event.${event.kind}`, { detail })}
                  </Link>
                  <p>{t(`calendar.explanation.${event.kind}`)}</p>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}
    </article>
  );
}
