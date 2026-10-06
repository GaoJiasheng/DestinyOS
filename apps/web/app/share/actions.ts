'use server';
import { requestIp } from '@/lib/request-ip';
import { z } from 'zod';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { recordEvent } from '@/lib/events';
import { getDb } from '@/lib/db';
import { ApiError } from '@/lib/api-error';
import { actionError } from '@/lib/api-error';
import { assertRateLimit, ratelimit } from '@/lib/ratelimit';
import { createShareForUser, signDailyCard } from '@/lib/share-service';
import { DailyCardSchema } from '@/lib/share-projection';
/** Create a share only for an owned reading, defaulting to the most private level. */
export async function createShareLinkAction(raw: unknown) {
  try {
    const session = await auth();
    if (!session?.user.id) throw new ApiError('E_UNAUTHORIZED', 'Sign in required', 401);
    const data = await createShareForUser(session.user.id, raw);
    return { ok: true as const, data };
  } catch (error) {
    return { ok: false as const, error: { code: actionError(error) } };
  }
}
/** Revoke an owner share and clear public status once no active links remain. */
export async function revokeShareLinkAction(token: string) {
  try {
    z.string()
      .regex(/^[a-zA-Z0-9]{22}$/)
      .parse(token);
    const session = await auth();
    if (!session?.user.id) throw new ApiError('E_UNAUTHORIZED', 'Sign in required', 401);
    await getDb().$transaction(async (tx) => {
      const link = await tx.shareLink.findFirst({ where: { token, userId: session.user.id } });
      if (!link) throw new ApiError('E_NOT_FOUND', 'Share not found', 404);
      await tx.shareLink.update({ where: { id: link.id }, data: { revokedAt: new Date() } });
      const count = await tx.shareLink.count({
        where: {
          readingId: link.readingId,
          revokedAt: null,
          OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
        },
      });
      if (!count)
        await tx.reading.update({ where: { id: link.readingId }, data: { isPublic: false } });
    });
    return { ok: true as const, data: { revoked: true } };
  } catch (error) {
    return { ok: false as const, error: { code: actionError(error) } };
  }
}
/** Anonymous daily signing accepts display fields only and never birth inputs. */
export async function signDailyCardAction(raw: unknown) {
  try {
    const input = DailyCardSchema.parse(raw);
    const session = await auth();
    const ip = requestIp(await headers());
    assertRateLimit(await ratelimit('share', session?.user.id ?? ip));
    const signed = signDailyCard(input);
    await recordEvent('share.created', {
      userId: session?.user.id,
      system: 'daily',
      locale: input.locale,
      plan: session?.user.plan ?? 'free',
    });
    return {
      ok: true as const,
      data: { url: `/api/v1/og/daily?payload=${signed.payload}&signature=${signed.signature}` },
    };
  } catch (error) {
    return { ok: false as const, error: { code: actionError(error) } };
  }
}
