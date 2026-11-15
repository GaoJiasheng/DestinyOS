'use client';
import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import type { CalendarEvent } from '@tianji/engine/calendar';
import { Link } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';

/** Upcoming entries the annual list shows before "show more"; the rest stay in the DOM but hidden. */
export const CALENDAR_EVENTS_PREVIEW = 10;

/** Split a year's events around today: ongoing intervals still count as upcoming. */
export function splitCalendarEvents(events: CalendarEvent[], today: string) {
  const upcoming: CalendarEvent[] = [],
    past: CalendarEvent[] = [];
  for (const event of events)
    ((event.endDate ?? event.date) >= today ? upcoming : past).push(event);
  return { upcoming, past };
}

/** Annual important dates: upcoming first (first ten, then "show more"), past ones collapsed. */
export function CalendarEvents({
  events,
  year,
  today,
}: {
  events: CalendarEvent[];
  year: number | null;
  today: string | null;
}) {
  const t = useTranslations(),
    locale = useLocale();
  const [expanded, setExpanded] = useState(false);
  const formatDate = (date: string, options: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat(locale, { ...options, timeZone: 'UTC' }).format(
      new Date(`${date}T12:00:00Z`),
    );
  const { upcoming, past } = today
    ? splitCalendarEvents(events, today)
    : { upcoming: events, past: [] };
  const item = (event: CalendarEvent, hidden = false) => {
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
      <li key={`${event.kind}:${event.at}`} data-calendar-event={event.kind} hidden={hidden}>
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
                end: formatDate(event.endDate, { year: 'numeric', month: 'short', day: 'numeric' }),
              })
            : null}{' '}
          · {t(`calendar.event.${event.kind}`, { detail })}
        </Link>
        <p>{t(`calendar.explanation.${event.kind}`)}</p>
      </li>
    );
  };
  const more = upcoming.length - CALENDAR_EVENTS_PREVIEW;
  return (
    <>
      {events.length && !upcoming.length ? <p>{t('calendar.upcomingEmpty')}</p> : null}
      <ul className="calendar-events" id="calendar-upcoming">
        {upcoming.map((event, i) => item(event, !expanded && i >= CALENDAR_EVENTS_PREVIEW))}
      </ul>
      {more > 0 && !expanded ? (
        <Button
          variant="secondary"
          aria-controls="calendar-upcoming"
          aria-expanded={false}
          onClick={() => setExpanded(true)}
        >
          {t('calendar.showMore', { count: more })}
        </Button>
      ) : null}
      {past.length ? (
        <details className="calendar-past">
          <summary>{t('calendar.pastDates', { count: past.length })}</summary>
          <ul className="calendar-events">{past.map((event) => item(event))}</ul>
        </details>
      ) : null}
    </>
  );
}
