import { Temporal } from '@js-temporal/polyfill';
// DESIGN-GAP: Date navigation must not eagerly load all anonymous calculation engines before the daily view paints.
/** Resolve a local date using an explicit IANA zone. */
export function localToday(tz: string, instant = Temporal.Now.instant().toString()) {
  return Temporal.Instant.from(instant).toZonedDateTimeISO(tz).toPlainDate().toString();
}

/** First and last civil dates the daily engine can calculate (B-06: 1900–2100). */
export const dailyDateRange = { min: '1900-01-01', max: '2100-12-31' } as const;

/**
 * Validate a `?date=` value; malformed or out-of-range input falls back to today instead of an error page.
 * @param value Raw search parameter.
 */
export function parseDailyDate(value: string | null | undefined): string | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  try {
    const date = Temporal.PlainDate.from(value, { overflow: 'reject' }).toString();
    return date >= dailyDateRange.min && date <= dailyDateRange.max ? date : null;
  } catch {
    return null;
  }
}

/** Move a civil date by whole days. */
export function shiftDate(date: string, days: number) {
  return Temporal.PlainDate.from(date).add({ days }).toString();
}

/**
 * The daily URL for a selected date; today keeps the canonical parameter-free address.
 * @param search Current query string, so unrelated parameters survive.
 */
export function dailyDateSearch(search: string, date: string, today: string) {
  const params = new URLSearchParams(search);
  if (date === today) params.delete('date');
  else params.set('date', date);
  const query = params.toString();
  return query ? `?${query}` : '';
}
