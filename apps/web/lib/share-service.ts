import { cache } from 'react';
import { recordShareView } from './share-counts';
import { ownedProfile } from './profile-service';
import { fromDbLocale } from './db-locale';
import { randomInt, createHmac, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { Temporal } from '@js-temporal/polyfill';
import { getDb } from './db';
import { dailyForUser } from './daily-service';
import { localToday } from './daily-compute';
import { getTranslations } from 'next-intl/server';
import { publicText } from './share-projection';
import { ApiError } from './api-error';
import { ReportSchema } from './reading-schema';
import { loadKnowledge } from './knowledge';
import { localizeReport, interpret } from '@tianji/interpret';
import { projectShare, DailyCardSchema, type DailyCard } from './share-projection';
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
    raw = interpret({
      system: link.reading.system,
      chart: link.reading.chart,
      locale: lang,
      knowledge: await loadKnowledge(link.reading.system, lang),
      context: {
        now: link.reading.createdAt.toISOString(),
        profileHasTime: true,
        engineVersion: link.reading.engineVersion,
      },
    });
  const view = projectShare(
    link.reading.system,
    link.reading.chart,
    localizeReport(ReportSchema.parse(raw), lang),
    z.enum(['chart', 'quote', 'daily', 'synastry']).parse(link.template),
    link.revealLevel,
  );
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
