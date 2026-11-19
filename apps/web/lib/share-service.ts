import { cache } from 'react';
import { recordShareView } from './share-counts';
import { ownedProfile } from './profile-service';
import { atomicBatch, guard, insertRow, updateRows } from './db-batch';
import { assertRateLimit, ratelimit } from './ratelimit';
import { recordEvent } from './events';
import { brand } from '@tianji/shared';
import { ShareTemplateSchema } from './share-projection';
import { fromDbLocale } from './db-locale';
import { randomInt, randomUUID, createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { stateReserve, stateRelease } from './state';
import { z } from 'zod';
import { Temporal } from '@js-temporal/polyfill';
import { getDb } from './db';
import { dailyForUser } from './daily-service';
import { localToday } from './daily-compute';
import { getTranslations, getLocale } from 'next-intl/server';
import { publicText } from './share-projection';
import { ApiError } from './api-error';
import { ReportSchema } from './reading-schema';
import { loadKnowledge } from './knowledge';
import { localizeReport, interpret } from '@tianji/interpret';
import {
  projectShare,
  DailyCardSchema,
  type DailyCard,
  type WebPublicShare,
} from './share-projection';
import { publicEmphasis, siblingEmphasis } from './emphasis-schema';
const alphabet = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
/** Generate an unbiased 22-character base62 bearer token. */
export function shareToken() {
  return Array.from({ length: 22 }, () => alphabet[randomInt(alphabet.length)]).join('');
}
// DESIGN-GAP: Availability is request-scoped, so layouts can reject revoked shares before streaming without repeating the owner lookup.
const activeShare = cache(async (token: string) => {
  if (!/^[a-zA-Z0-9]{22}$/.test(token)) throw new ApiError('E_NOT_FOUND', 'Share not found', 404);
  const link = await getDb().shareLink.findUnique({
    where: { token },
    include: {
      reading: {
        select: {
          profileId: true,
          system: true,
          chart: true,
          reportZh: true,
          reportEn: true,
          createdAt: true,
          engineVersion: true,
          knowledgeVersion: true,
        },
      },
      user: { select: { deletedAt: true, locale: true, tz: true } },
    },
  });
  if (
    !link ||
    link.revokedAt ||
    link.user.deletedAt ||
    (link.expiresAt && link.expiresAt <= new Date())
  )
    throw new ApiError('E_NOT_FOUND', 'Share not found', 404);
  return link;
});
/** Guard a share layout outside its page loading boundary, retaining the documented HTTP 404. */
export async function assertActiveShare(token: string): Promise<void> {
  await activeShare(token);
}
/** Resolve active shares and an explicit safe projection, never owner inputs or a raw report. */
export async function publicShare(token: string, locale?: 'zh' | 'en' | 'zh-TW') {
  const link = await activeShare(token);
  const lang = locale ?? fromDbLocale(link.user.locale);
  let raw: unknown = lang !== 'en' ? link.reading.reportZh : link.reading.reportEn;
  if (!raw)
    raw = siblingEmphasis(
      interpret({
        system: link.reading.system,
        chart: link.reading.chart,
        locale: lang,
        knowledge: await loadKnowledge(link.reading.system, lang),
        context: {
          now: link.reading.createdAt.toISOString(),
          profileHasTime: true,
          engineVersion: link.reading.engineVersion,
        },
      }),
      lang !== 'en' ? link.reading.reportEn : link.reading.reportZh,
    );
  const report = ReportSchema.parse(raw);
  const view: WebPublicShare = projectShare(
    link.reading.system,
    link.reading.chart,
    localizeReport(report, lang),
    z.enum(['chart', 'quote', 'daily', 'synastry']).parse(link.template),
    link.revealLevel,
  );
  // Only the strongest dimension at band 4–5 is public; other bands, raw values and basis never are.
  const emphasis = publicEmphasis(report.headline.emphasis);
  if (emphasis) view.emphasis = emphasis;
  // DESIGN-GAP: A natal reading's daily template uses the share creation day and current profile version, rather than adding undocumented ShareLink columns.
  if (link.template === 'daily') {
    const profile = link.reading.profileId
      ? await ownedProfile(link.userId, link.reading.profileId)
      : null;
    const tz = link.user.tz ?? profile?.tz ?? 'UTC';
    const { chart, report } = await dailyForUser(
      link.userId,
      localToday(tz, link.createdAt.toISOString()),
      tz,
      lang,
      link.reading.profileId ?? undefined,
    );
    const t = await getTranslations({ locale: lang });
    view.daily = {
      locale: lang,
      date: chart.date.local,
      headline: t(chart.oneLiner),
      stars:
        chart.scores.overall >= 85
          ? 5
          : chart.scores.overall >= 70
            ? 4
            : chart.scores.overall >= 55
              ? 3
              : chart.scores.overall >= 40
                ? 2
                : 1,
      color: t(chart.bazi.luckyColor[0]!),
      numbers: chart.bazi.luckyNumbers,
      do: report.doDont?.do ?? [],
      dont: report.doDont?.dont ?? [],
    };
  }
  await recordShareView(token);
  return view;
}
function signingKey() {
  // DESIGN-GAP: Use a purpose-separated HMAC key derived from AUTH_SECRET; no additional deployment secret is required.
  if (!process.env.AUTH_SECRET) throw new Error('AUTH_SECRET required');
  return createHmac('sha256', process.env.AUTH_SECRET).update('tianji.daily-card.v1').digest();
}
/** Sign only a bounded, birth-free daily display payload, with a 24-hour expiration. */
export function signDailyCard(raw: DailyCard, now = Date.now()) {
  const validated = DailyCardSchema.parse(raw);
  const data = {
    ...validated,
    headline: publicText(validated.headline),
    color: publicText(validated.color),
    do: validated.do.map(publicText),
    dont: validated.dont.map(publicText),
  };
  const payload = Buffer.from(
    JSON.stringify({ data, exp: Math.floor(now / 1000) + 86400 }),
  ).toString('base64url');
  const signature = createHmac('sha256', signingKey()).update(payload).digest('base64url');
  return { payload, signature };
}
/** Verify MAC before parsing; alteration, expiry and extra birth fields all fail closed. */
export function verifyDailyCard(payload: string, signature: string, now = Date.now()): DailyCard {
  if (payload.length > 5000 || !/^[A-Za-z0-9_-]{43}$/.test(signature))
    throw new ApiError('E_FORBIDDEN', 'Invalid signature', 403);
  const expected = createHmac('sha256', signingKey()).update(payload).digest(),
    provided = Buffer.from(signature, 'base64url');
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected))
    throw new ApiError('E_FORBIDDEN', 'Invalid signature', 403);
  const value = z
    .object({ data: DailyCardSchema, exp: z.number().int() })
    .strict()
    .parse(JSON.parse(Buffer.from(payload, 'base64url').toString()));
  if (value.exp < Math.floor(now / 1000))
    throw new ApiError('E_FORBIDDEN', 'Expired signature', 403);
  Temporal.PlainDate.from(value.data.date);
  return value.data;
}

/** Create an owner-only share with the same Web projection, limits and privacy defaults. */
export async function createShareForUser(
  userId: string,
  raw: unknown,
  locale?: 'zh' | 'en' | 'zh-TW',
) {
  const input = z
    .object({
      readingId: z.string().min(1).max(100),
      template: ShareTemplateSchema,
      revealLevel: z.number().int().min(0).max(2).default(0),
      expiresIn: z.union([z.literal(7), z.literal(30)]).optional(),
    })
    .strict()
    .parse(raw);
  assertRateLimit(await ratelimit('share', userId));
  const reading = await getDb().reading.findFirst({
    where: { id: input.readingId, userId: userId },
  });
  if (!reading) throw new ApiError('E_FORBIDDEN', 'Reading access denied', 403);
  const user = await getDb().user.findFirst({ where: { id: userId, deletedAt: null } });
  if (!user) throw new ApiError('E_UNAUTHORIZED', 'Account unavailable', 401);
  if (
    input.template === 'daily' &&
    !(await getDb().birthProfile.findFirst({
      where: { userId: userId, isCurrent: true },
      select: { id: true },
    }))
  )
    throw new ApiError('E_PROFILE_REQUIRED', 'Birth profile required for a daily card', 400);
  const origin = process.env.NEXT_PUBLIC_SITE_URL ?? `https://${brand.domain}`;
  const daily = input.template === 'daily';
  // A daily card renders the day it was created, so it is reused only within that local day.
  const tz = daily ? (user.tz ?? (await currentProfileTz(userId)) ?? 'UTC') : 'UTC';
  const today = daily ? localToday(tz) : '';
  const findReusable = async () =>
    (await activeLinks(userId, reading.id)).find(
      (link) =>
        link.template === input.template &&
        link.revealLevel === input.revealLevel &&
        expiryDays(link) === (input.expiresIn ?? null) &&
        (!daily || localToday(tz, link.createdAt.toISOString()) === today),
    );
  const reuse = (link: { token: string; expiresAt: Date | null }) => ({
    token: link.token,
    url: `${origin}/s/${link.token}`,
    expiresAt: link.expiresAt?.toISOString() ?? null,
    reused: true,
  });
  const existing = await findReusable();
  if (existing) return reuse(existing);
  // ShareLink has no unique key for this, so concurrent daily taps serialise on a short lease and
  // re-check under it: the loser either sees the winner's link or is told to retry.
  const lockKey = `share:daily:${createHash('sha256')
    .update(`${userId}:${reading.id}:${today}:${input.revealLevel}:${input.expiresIn ?? 0}`)
    .digest('hex')}`;
  const lease = randomUUID();
  if (daily && !(await stateReserve(lockKey, lease, 15))) {
    for (let i = 0; i < 5; i++) {
      await new Promise((resolve) => setTimeout(resolve, 200));
      const winner = await findReusable();
      if (winner) return reuse(winner);
    }
    throw new ApiError('E_CONFLICT', 'Share is already being created', 409);
  }
  const createLink = async () => {
    const token = shareToken();
    const expiresAt = input.expiresIn ? new Date(Date.now() + input.expiresIn * 86400000) : null;
    await atomicBatch([
      ...guard(
        'EXISTS (SELECT 1 FROM "Reading" r JOIN "User" u ON u.id=r."userId" WHERE r.id=? AND u.id=? AND u."deletedAt" IS NULL)',
        reading.id,
        userId,
      ),
      insertRow('ShareLink', {
        token,
        readingId: reading.id,
        userId,
        template: input.template,
        revealLevel: input.revealLevel,
        expiresAt,
      }),
      updateRows('Reading', { isPublic: true }, 'id=? AND "userId"=?', reading.id, userId),
    ]);
    await recordEvent('share.created', {
      userId: userId,
      system: reading.system,
      locale: locale ?? ((await getLocale()) === 'en' ? 'en' : 'zh'),
      plan: user.plan,
    });
    return {
      token,
      url: `${origin}/s/${token}`,
      expiresAt: expiresAt?.toISOString() ?? null,
      reused: false,
    };
  };
  try {
    if (daily) {
      const winner = await findReusable();
      if (winner) return reuse(winner);
    }
    return await createLink();
  } finally {
    if (daily) await stateRelease(lockKey, lease);
  }
}
/** Timezone of the owner's current profile, for users who never set one. */
async function currentProfileTz(userId: string) {
  const row = await getDb().birthProfile.findFirst({
    where: { userId, isCurrent: true },
    orderBy: { createdAt: 'asc' },
    select: { tz: true },
  });
  return row?.tz ?? null;
}
/** Owner's live (not revoked, not expired) links for one reading, newest first. */
export function activeLinks(userId: string, readingId: string) {
  return getDb().shareLink.findMany({
    where: {
      userId,
      readingId,
      revokedAt: null,
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    },
    orderBy: { createdAt: 'desc' },
    select: { token: true, template: true, revealLevel: true, createdAt: true, expiresAt: true },
  });
}
/** The 7/30-day option a link was created with, or null for a link without expiry. */
function expiryDays(link: { createdAt: Date; expiresAt: Date | null }) {
  return link.expiresAt
    ? Math.round((link.expiresAt.getTime() - link.createdAt.getTime()) / 86400000)
    : null;
}
