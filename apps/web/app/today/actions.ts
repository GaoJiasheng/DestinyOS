'use server';
import { fromDbLocale } from '@/lib/db-locale';
import { requestIp } from '@/lib/request-ip';
import { z } from 'zod';
import { Temporal } from '@js-temporal/polyfill';
import { cookies, headers } from 'next/headers';
import { currentProfile, ownedProfile } from '@/lib/profile-service';
import { auth } from '@/lib/auth';
import { recordEvent } from '@/lib/events';
import { getDb } from '@/lib/db';
import { dailyRangeDates, type DailyRangeDay } from '@tianji/engine/daily';
import type { CalendarEvent } from '@tianji/engine/calendar';
import { dailyRangeForUser, calendarYearForUser } from '@/lib/calendar-service';
import { dailyForUser } from '@/lib/daily-service';
import { localToday } from '@/lib/daily-compute';
import { ApiError } from '@/lib/api-error';
import { assertRateLimit, ratelimit } from '@/lib/ratelimit';
import { actionError } from '@/lib/api-error';
import type { ActionResult } from '@/lib/reading-schema';
import type { DailyReport } from '@/lib/daily-compute';
import { IanaTimezoneSchema, Locale } from '@tianji/shared';
/** Fetch a signed-in user's daily fortune; anonymous clients calculate locally. */
export async function getDailyAction(raw: unknown = {}): Promise<ActionResult<DailyReport>> {
  try {
    // DESIGN-GAP: locale is an optional action input because SA calls have no locale route parameter.
    const input = z
      .object({
        date: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/)
          .refine((date) => {
            try {
              Temporal.PlainDate.from(date, { overflow: 'reject' });
              return true;
            } catch {
              return false;
            }
          })
          .optional(),
        // DESIGN-GAP: Pin the displayed daily forecast to the same owned profile as the journal, even if another tab changes the profile cookie.
        profileId: z.string().min(1).optional(),
        tz: IanaTimezoneSchema.optional(),
        locale: z.nativeEnum(Locale).optional(),
      })
      .strict()
      .parse(raw);
    const session = await auth();
    if (!session?.user.id) throw new ApiError('E_UNAUTHORIZED', 'Sign in required', 401);
    const user = await getDb().user.findUniqueOrThrow({ where: { id: session.user.id } });
    const profile = input.profileId
      ? await ownedProfile(user.id, input.profileId)
      : await currentProfile(user.id);
    const tz =
      input.tz ??
      user.tz ??
      ((await cookies()).get('tz')?.value
        ? decodeURIComponent((await cookies()).get('tz')!.value)
        : undefined) ??
      profile?.tz ??
      'UTC';
    const date = input.date ?? localToday(tz);
    // DESIGN-GAP: B-06 expands daily browsing to the engine's supported 1900–2100 years.
    const target = Temporal.PlainDate.from(date);
    if (target.year < 1900 || target.year > 2100)
      throw new ApiError('E_DATE_OUT_OF_RANGE', 'Date outside engine range', 400);
    assertRateLimit(await ratelimit('daily', user.id));
    const language = input.locale ?? fromDbLocale(user.locale);
    const data = input.profileId
      ? await dailyForUser(user.id, date, tz, language, input.profileId)
      : await dailyForUser(user.id, date, tz, language);
    await recordEvent('daily.viewed', {
      userId: user.id,
      system: 'daily',
      locale: input.locale ?? fromDbLocale(user.locale),
      plan: user.plan,
    });
    return { ok: true, data };
  } catch (error) {
    return { ok: false, error: { code: actionError(error) } };
  }
}

/** Record a local anonymous daily visit using dimensions only; no birth or device identifier leaves the browser. */
export async function recordAnonymousDailyViewAction(locale: string) {
  try {
    const language = z.nativeEnum(Locale).parse(locale);
    const ip = requestIp(await headers());
    if (!(await ratelimit('daily', ip)).success) return;
    await recordEvent('daily.viewed', { system: 'daily', locale: language, plan: 'free' });
  } catch {
    /* Offline anonymous calculation remains fully usable. */
  }
}

/** Owner-only inclusive calendar range; rejects reversed or over-31-day requests before computing. */
export async function getDailyRangeAction(raw: unknown): Promise<ActionResult<DailyRangeDay[]>> {
  try {
    const input = z
      .object({
        from: z.string(),
        to: z.string(),
        tz: IanaTimezoneSchema,
        locale: z.nativeEnum(Locale).default('zh'),
      })
      .strict()
      .parse(raw);
    dailyRangeDates(input.from, input.to, input.tz);
    const session = await auth();
    if (!session?.user.id) throw new ApiError('E_UNAUTHORIZED', 'Sign in required', 401);
    assertRateLimit(await ratelimit('daily', session.user.id));
    return {
      ok: true,
      data: await dailyRangeForUser(session.user.id, input.from, input.to, input.tz, input.locale),
    };
  } catch (error) {
    return { ok: false, error: { code: actionError(error) } };
  }
}
// DESIGN-GAP: Annual events need a separate owner-only action because getDailyRangeAction's documented response is scores only.
/** Fetch engine-computed annual events from the owner+year cache. */
export async function getCalendarYearAction(raw: unknown): Promise<ActionResult<CalendarEvent[]>> {
  try {
    const input = z
      .object({
        year: z.number().int().min(1900).max(2100),
        tz: IanaTimezoneSchema,
        locale: z.nativeEnum(Locale).default('zh'),
      })
      .strict()
      .parse(raw);
    const session = await auth();
    if (!session?.user.id) throw new ApiError('E_UNAUTHORIZED', 'Sign in required', 401);
    assertRateLimit(await ratelimit('daily', session.user.id));
    return {
      ok: true,
      data: await calendarYearForUser(session.user.id, input.year, input.tz, input.locale),
    };
  } catch (error) {
    return { ok: false, error: { code: actionError(error) } };
  }
}
