'use server';
import { z } from 'zod';
import { Temporal } from '@js-temporal/polyfill';
import { cookies, headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { recordEvent } from '@/lib/events';
import { getDb } from '@/lib/db';
import { dailyForUser } from '@/lib/daily-service';
import { localToday } from '@/lib/daily-compute';
import { ApiError } from '@/lib/api-error';
import { assertRateLimit, ratelimit } from '@/lib/ratelimit';
import { actionError } from '@/lib/reading-service';
import type { ActionResult } from '@/lib/reading-schema';
import type { DailyReport } from '@/lib/daily-compute';
/** Fetch a signed-in user's daily fortune; anonymous clients calculate locally. */
export async function getDailyAction(raw: unknown = {}): Promise<ActionResult<DailyReport>> {
  try {
    // DESIGN-GAP: locale is an optional action input because SA calls have no locale route parameter.
    const input = z
      .object({
        date: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/)
          .optional(),
        tz: z.string().max(100).optional(),
        locale: z.enum(['zh', 'en']).optional(),
      })
      .strict()
      .parse(raw);
    const session = await auth();
    if (!session?.user.id) throw new ApiError('E_UNAUTHORIZED', 'Sign in required', 401);
    const user = await getDb().user.findUniqueOrThrow({ where: { id: session.user.id } });
    const profile = await getDb().birthProfile.findFirst({
      where: { userId: user.id, isCurrent: true },
      select: { tz: true },
    });
    const tz =
      input.tz ??
      user.tz ??
      ((await cookies()).get('tz')?.value
        ? decodeURIComponent((await cookies()).get('tz')!.value)
        : undefined) ??
      profile?.tz ??
      'UTC';
    const date = input.date ?? localToday(tz);
    const today = Temporal.PlainDate.from(localToday(tz)),
      target = Temporal.PlainDate.from(date);
    if (
      Temporal.PlainDate.compare(target, today.add({ days: 1 })) > 0 ||
      Temporal.PlainDate.compare(target, today.subtract({ days: 1 })) < 0
    )
      throw new ApiError(
        'E_DATE_OUT_OF_RANGE',
        'Only yesterday, today and tomorrow are available',
        400,
      );
    assertRateLimit(await ratelimit('daily', user.id));
    const data = await dailyForUser(user.id, date, tz, input.locale ?? user.locale);
    await recordEvent('daily.viewed', {
      userId: user.id,
      system: 'daily',
      locale: input.locale ?? user.locale,
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
    const language = z.enum(['zh', 'en']).parse(locale);
    const ip = (await headers()).get('x-forwarded-for')?.split(',')[0] ?? 'unknown';
    if (!(await ratelimit('daily', ip)).success) return;
    await recordEvent('daily.viewed', { system: 'daily', locale: language, plan: 'free' });
  } catch {
    /* Offline anonymous calculation remains fully usable. */
  }
}
