'use server';
import { z } from 'zod';
import { toDbLocale } from '@/lib/db-locale';
import { auth } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { ApiError } from '@/lib/api-error';
import { actionError } from '@/lib/reading-service';
import { SettingsSchema, softDeleteAccount } from '@/lib/account-service';
import { cookies } from 'next/headers';
/** Persist only validated owner settings. */
export async function updateSettingsAction(raw: unknown) {
  try {
    const input = SettingsSchema.parse(raw),
      session = await auth();
    if (!session?.user.id) throw new ApiError('E_UNAUTHORIZED', 'Sign in required', 401);
    await getDb().user.update({
      where: { id: session.user.id },
      data: { ...input, locale: input.locale ? toDbLocale(input.locale) : undefined },
    });
    if (input.tz) (await cookies()).set('tz', input.tz, { sameSite: 'lax', path: '/' });
    if (input.tz === null) (await cookies()).delete('tz');
    if (input.locale)
      (await cookies()).set('NEXT_LOCALE', input.locale, { sameSite: 'lax', path: '/' });
    return { ok: true as const, data: { saved: true } };
  } catch (e) {
    return { ok: false as const, error: { code: actionError(e) } };
  }
}
/** Exact DELETE confirmation soft-deletes and immediately invalidates all sessions and shares. */
export async function deleteAccountAction(confirmText: string, deleteFeedback = false) {
  try {
    z.literal('DELETE').parse(confirmText);
    z.boolean().parse(deleteFeedback);
    const session = await auth();
    if (!session?.user.id) throw new ApiError('E_UNAUTHORIZED', 'Sign in required', 401);
    await softDeleteAccount(session.user.id, deleteFeedback);
    const jar = await cookies();
    for (const name of ['authjs.session-token', '__Secure-authjs.session-token']) jar.delete(name);
    return { ok: true as const, data: { deleted: true } };
  } catch (e) {
    return { ok: false as const, error: { code: actionError(e) } };
  }
}

/** Read only the current user's UI settings for post-hydration synchronization. */
export async function getSettingsAction() {
  const session = await auth();
  return session?.user.id
    ? getDb().user.findUnique({
        where: { id: session.user.id },
        select: { theme: true, reducedMotion: true, soundOn: true, tz: true },
      })
    : null;
}

/** Store an explicit first-use acknowledgement as an account preference when authenticated. */
export async function acknowledgeDisclaimerAction() {
  if (!process.env.DATABASE_URL || !process.env.AUTH_SECRET) return;
  const session = await auth();
  if (session?.user.id)
    await getDb().user.updateMany({
      where: { id: session.user.id, disclaimerAcceptedAt: null, deletedAt: null },
      data: { disclaimerAcceptedAt: new Date() },
    });
}
/** Restore the acknowledgement across devices without exposing profile information. */
export async function getDisclaimerAcknowledgementAction() {
  if (!process.env.DATABASE_URL || !process.env.AUTH_SECRET) return false;
  const session = await auth();
  if (!session?.user.id) return false;
  const user = await getDb().user.findUnique({
    where: { id: session.user.id },
    select: { disclaimerAcceptedAt: true },
  });
  return Boolean(user?.disclaimerAcceptedAt);
}
