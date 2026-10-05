import { Temporal } from '@js-temporal/polyfill';
import { computeDailyRange } from '@tianji/engine/daily';
import { computeCalendarYear } from '@tianji/engine/calendar';
import type { CalendarWorkerRequest, CalendarWorkerResponse } from './calendar-worker-types';

// DESIGN-GAP: Month transits and annual astronomy run on-device off the main thread; only scores/events return and private birth data never crosses the network.
self.addEventListener('message', (event: MessageEvent<CalendarWorkerRequest>) => {
  let response: CalendarWorkerResponse;
  try {
    const { profile, month, tz, identity, locale } = event.data;
    const start = Temporal.PlainDate.from(`${month}-01`);
    response = {
      ok: true,
      days: computeDailyRange(
        profile,
        start.toString(),
        start.with({ day: start.daysInMonth }).toString(),
        tz,
        identity,
        locale,
      ),
      events: computeCalendarYear(profile, start.year, tz, locale),
    };
  } catch {
    response = { ok: false, code: 'E_INTERNAL' };
  }
  self.postMessage(response);
});
