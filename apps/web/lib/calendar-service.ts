import { z } from 'zod';
import { BirthInputSchema, type Locale } from '@tianji/shared';
import { computeDailyRange, type DailyRangeDay } from '@tianji/engine/daily';
import {
  computeCalendarYear,
  CalendarEventSchema,
  type CalendarEvent,
} from '@tianji/engine/calendar';
import { ENGINE_VERSION } from '@tianji/engine/version';
import { currentProfile } from './profile-service';
import { getLocalRedis, getUpstashRedis } from './redis';
import { ApiError } from './api-error';
/** Owner profile is decrypted only inside the service; client inputs never select a user. */
async function ownerProfile(userId: string) {
  const profile = await currentProfile(userId);
  if (!profile) throw new ApiError('E_PROFILE_REQUIRED', 'Birth profile required', 400);
  const birth = BirthInputSchema.parse({
    ...JSON.parse(profile.encBirth),
    place: profile.encPlace ? JSON.parse(profile.encPlace) : undefined,
    gender: profile.gender,
  });
  return { profile, birth };
}
/** One month of scores, with one profile read and shared natal charts. */
export async function dailyRangeForUser(
  userId: string,
  from: string,
  to: string,
  tz: string,
  locale: Locale,
): Promise<DailyRangeDay[]> {
  const { birth } = await ownerProfile(userId);
  return computeDailyRange(birth, from, to, tz, userId, locale);
}
// DESIGN-GAP: Annual cache TTL is 24 hours; profile version, engine version, locale and zone prevent stale personal transitions after edits or travel.
/** Annual events cached by owner and year, with validated data on cache reads. */
export async function calendarYearForUser(
  userId: string,
  year: number,
  tz: string,
  locale: Locale,
): Promise<CalendarEvent[]> {
  const { profile, birth } = await ownerProfile(userId);
  const key = `calendar:${userId}:${profile.id}:${profile.version}:${year}:${encodeURIComponent(tz)}:${locale}:${ENGINE_VERSION}`;
  const remote = Boolean(process.env.UPSTASH_REDIS_REST_URL);
  const cached = remote
    ? await getUpstashRedis().get<unknown>(key)
    : await getLocalRedis().get(key);
  if (cached) {
    try {
      const parsed = z
        .array(CalendarEventSchema)
        .safeParse(typeof cached === 'string' ? JSON.parse(cached) : cached);
      if (parsed.success) return parsed.data;
    } catch {
      /* Discard invalid cache entries and recompute. */
    }
  }
  const events = computeCalendarYear(birth, year, tz, locale);
  if (remote) await getUpstashRedis().set(key, events, { ex: 86400 });
  else await getLocalRedis().set(key, JSON.stringify(events), 'EX', 86400);
  return events;
}
