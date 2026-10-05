import { Temporal } from '@js-temporal/polyfill';
// DESIGN-GAP: Date navigation must not eagerly load all anonymous calculation engines before the daily view paints.
/** Resolve a local date using an explicit IANA zone. */
export function localToday(tz: string, instant = Temporal.Now.instant().toString()) {
  return Temporal.Instant.from(instant).toZonedDateTimeISO(tz).toPlainDate().toString();
}
