'use server';
import { requestIp } from '@/lib/request-ip';
import { z } from 'zod';
import { headers } from 'next/headers';
import { getLocale } from 'next-intl/server';
import { auth } from '@/lib/auth';
import { recordEvent } from '@/lib/events';
import { getDb } from '@/lib/db';
import { ApiError } from '@/lib/api-error';
import { actionError } from '@/lib/reading-service';
import { assertRateLimit, ratelimit } from '@/lib/ratelimit';
import { shareToken, signDailyCard } from '@/lib/share-service';
import { ShareTemplateSchema, DailyCardSchema } from '@/lib/share-projection';
import { brand } from '@tianji/shared';
/** Create a share only for an owned reading, defaulting to the most private level. */
export async function createShareLinkAction(raw: unknown) {
  try {
    const input = z
      .object({
        readingId: z.string().min(1).max(100),
        template: ShareTemplateSchema,
        revealLevel: z.number().int().min(0).max(2).default(0),
        expiresIn: z.union([z.literal(7), z.literal(30)]).optional(),
      })
      .strict()
      .parse(raw);
    const session = await auth();
    if (!session?.user.id) throw new ApiError('E_UNAUTHORIZED', 'Sign in required', 401);
    assertRateLimit(await ratelimit('share', session.user.id));
    const reading = await getDb().reading.findFirst({
      where: { id: input.readingId, userId: session.user.id },
    });
    if (!reading) throw new ApiError('E_FORBIDDEN', 'Reading access denied', 403);
    if (
      input.template === 'daily' &&
      !(await getDb().birthProfile.findFirst({
        where: { userId: session.user.id, isCurrent: true },
        select: { id: true },
      }))
    )
      throw new ApiError('E_PROFILE_REQUIRED', 'Birth profile required for a daily card', 400);
    const token = shareToken();
    await getDb().$transaction(async (tx) => {
      await tx.shareLink.create({
        data: {
          token,
          readingId: reading.id,
          userId: session.user.id,
          template: input.template,
          revealLevel: input.revealLevel,
          expiresAt: input.expiresIn ? new Date(Date.now() + input.expiresIn * 86400000) : null,
        },
      });
      await tx.reading.update({ where: { id: reading.id }, data: { isPublic: true } });
    });
    await recordEvent('share.created', {
      userId: session.user.id,
      system: reading.system,
      locale: (await getLocale()) === 'en' ? 'en' : 'zh',
      plan: session.user.plan,
    });
    const origin = process.env.NEXT_PUBLIC_SITE_URL ?? `https://${brand.domain}`;
    return { ok: true as const, data: { token, url: `${origin}/s/${token}` } };
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
