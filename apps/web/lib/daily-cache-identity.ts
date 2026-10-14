import { Temporal } from '@js-temporal/polyfill';
import type { Locale } from '@tianji/shared';
/** Cache identity follows systems/daily §7, including both release versions. */
export function dailyCacheKey(
  userId: string,
  profileVersion: number,
  date: string,
  locale: Locale,
  kv: string,
  ev: string,
) {
  return `daily:${userId}:${profileVersion}:${date}:${locale}:${kv}:${ev}`;
}
/** Expire at the requested local day's next 02:00, respecting DST transitions. */
export function dailyTTL(date: string, tz: string, now = Temporal.Now.instant().toString()) {
  const end = Temporal.PlainDate.from(date)
    .add({ days: 1 })
    .toZonedDateTime({ timeZone: tz, plainTime: '02:00' })
    .toInstant();
  // DESIGN-GAP: Yesterday's already-past expiry gets a 60-second TTL so browsing never creates immortal entries.
  return Math.max(
    60,
    Math.ceil((end.epochMilliseconds - Temporal.Instant.from(now).epochMilliseconds) / 1000),
  );
}
