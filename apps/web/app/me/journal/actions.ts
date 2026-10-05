'use server';
import { z } from 'zod';
import { IanaTimezoneSchema, Locale, JournalInputSchema, JournalKeySchema } from '@tianji/shared';
import { auth } from '@/lib/auth';
import { ApiError } from '@/lib/api-error';
import { assertRateLimit, ratelimit } from '@/lib/ratelimit';
import { actionError } from '@/lib/api-error';
import { journalEntryForUser, journalMonthForUser, saveJournalEntry } from '@/lib/journal-service';
async function owner() {
  const session = await auth();
  if (!session?.user.id) throw new ApiError('E_UNAUTHORIZED', 'Sign in required', 401);
  // DESIGN-GAP: Journal actions share the existing daily quota (120/hour); no new API rate group is documented.
  assertRateLimit(await ratelimit('daily', session.user.id));
  return session.user.id;
}
/** Load the authenticated owner's existing civil-day entry. */
export async function getJournalEntryAction(raw: unknown) {
  try {
    const input = JournalKeySchema.parse(raw),
      userId = await owner();
    return { ok: true as const, data: await journalEntryForUser(userId, input) };
  } catch (error) {
    return { ok: false as const, error: { code: actionError(error) } };
  }
}
/** Encrypt the validated owner's note and persist the matching server-computed prediction. */
export async function saveJournalEntryAction(raw: unknown, locale: string) {
  try {
    const input = JournalInputSchema.parse(raw),
      language = z.nativeEnum(Locale).parse(locale),
      userId = await owner();
    return { ok: true as const, data: await saveJournalEntry(userId, input, language) };
  } catch (error) {
    return { ok: false as const, error: { code: actionError(error) } };
  }
}
/** Load one month and all-time summary for an explicitly owned profile. */
export async function getJournalMonthAction(raw: unknown) {
  try {
    const input = z
        .object({
          profileId: z.string().min(1),
          month: z.string().regex(/^(19\d{2}|20\d{2}|2100)-(0[1-9]|1[0-2])$/),
          tz: IanaTimezoneSchema,
          locale: z.nativeEnum(Locale),
        })
        .strict()
        .parse(raw),
      userId = await owner();
    return {
      ok: true as const,
      data: await journalMonthForUser(userId, input.profileId, input.month, input.tz, input.locale),
    };
  } catch (error) {
    return { ok: false as const, error: { code: actionError(error) } };
  }
}
