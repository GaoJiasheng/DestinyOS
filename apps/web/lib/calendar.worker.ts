import { Temporal } from '@js-temporal/polyfill';
import { computeDailyRange } from '@tianji/engine/daily';
import { computeCalendarYear } from '@tianji/engine/calendar';
import type { CalendarWorkerRequest, CalendarWorkerResponse } from './calendar-worker-types';

// DESIGN-GAP: Month transits and annual astronomy run on-device off the main thread; only scores/events return and private birth data never crosses the network.
self.addEventListener('message', (event: MessageEvent<CalendarWorkerRequest>) => {
  let response: CalendarWorkerResponse;
  try {
    const { profile, month, from, to, tz, identity, locale } = event.data;
    const start = Temporal.PlainDate.from(month ? `${month}-01` : from!);
    const end = month ? start.with({ day: start.daysInMonth }) : Temporal.PlainDate.from(to!);
    response = {
      ok: true,
      days: computeDailyRange(profile, start.toString(), end.toString(), tz, identity, locale),
      // DESIGN-GAP: Week views only chart scores, so skip the annual astronomy pass used by month views.
      events: month ? computeCalendarYear(profile, start.year, tz, locale) : [],
    };
  } catch {
    response = { ok: false, code: 'E_INTERNAL' };
  }
  self.postMessage(response);
});
