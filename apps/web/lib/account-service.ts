import { timingSafeEqual } from 'node:crypto';
import { BirthInputSchema } from '@tianji/shared';
import { getDb } from './db';
import { ApiError } from './api-error';
import { getLocalRedis, getUpstashRedis } from './redis';
export { SettingsSchema } from './account-service-schema';
/** Export only owner data; credential tables and encrypted envelopes are excluded. */
export async function exportAccount(userId: string) {
  const db = getDb(),
    user = await db.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        locale: true,
        tz: true,
        theme: true,
        soundOn: true,
        reducedMotion: true,
        disclaimerAcceptedAt: true,
        createdAt: true,
        deletedAt: true,
      },
    });
  if (user.deletedAt) throw new ApiError('E_UNAUTHORIZED', 'Deleted account', 401);
  const profiles = await db.birthProfile.findMany({
    where: { userId },
    orderBy: { version: 'asc' },
  });
  const readings = await db.reading.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } });
  const subscription = await db.subscription.findUnique({
    where: { userId },
    select: { status: true, currentPeriodEnd: true, cancelAtPeriodEnd: true },
  });
  return {
    user,
    profiles: profiles.map((p) => ({
      version: p.version,
      isCurrent: p.isCurrent,
      birth: BirthInputSchema.parse({
        ...JSON.parse(p.encBirth),
        place: p.encPlace ? JSON.parse(p.encPlace) : undefined,
        gender: p.gender,
      }),
      name: p.encName,
    })),
    readings: readings.map((r) => ({
      id: r.id,
      system: r.system,
      createdAt: r.createdAt,
      title: r.title,
      input: JSON.parse(r.encInput) as unknown,
      chart: r.chart,
      reportZh: r.reportZh,
      reportEn: r.reportEn,
      engineVersion: r.engineVersion,
      knowledgeVersion: r.knowledgeVersion,
    })),
    subscription,
  };
}
/** Enforce the documented export quota with one atomic Redis reservation. */
export async function reserveExport(userId: string) {
  const key = `export:${userId}`;
  const result = process.env.UPSTASH_REDIS_REST_URL
    ? await getUpstashRedis().set(key, '1', { nx: true, ex: 600 })
    : await getLocalRedis().set(key, '1', 'EX', 600, 'NX');
  if (!result)
    throw new ApiError('E_RATE_LIMITED', 'Export allowed once per ten minutes', 429, {
      retryAfter: 600,
    });
}
/** Cancel billing before the atomic soft delete, allowing safe retries if Stripe is unavailable. */
export async function softDeleteAccount(
  userId: string,
  deleteFeedback = false,
  actor = 'system:account',
) {
  const db = getDb();
  const subscription = await db.subscription.findUnique({ where: { userId } });
  if (subscription?.stripeSubscriptionId && subscription.status !== 'canceled') {
    if (!process.env.STRIPE_SECRET_KEY)
      throw new ApiError('E_PAYMENT', 'Stripe credentials required', 502);
    const response = await fetch(
      `https://api.stripe.com/v1/subscriptions/${encodeURIComponent(subscription.stripeSubscriptionId)}`,
      {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}` },
        signal: AbortSignal.timeout(10000),
      },
    );
    if (!response.ok) throw new ApiError('E_PAYMENT', 'Subscription cancellation failed', 502);
  }
  // DESIGN-GAP: Feedback deletion is an optional second action argument; default retention follows 06 §4.
  await db.$transaction(async (tx) => {
    await tx.user.update({ where: { id: userId }, data: { deletedAt: new Date(), plan: 'free' } });
    await tx.session.deleteMany({ where: { userId } });
    await tx.shareLink.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    await tx.reading.updateMany({ where: { userId }, data: { isPublic: false } });
    if (deleteFeedback) await tx.feedback.deleteMany({ where: { userId } });
    else
      await tx.feedback.updateMany({ where: { userId }, data: { userId: null, readingId: null } });
    await tx.adminAuditLog.create({
      data: {
        adminId: actor,
        action: 'user.soft_delete',
        ...(actor === 'system:account' ? {} : { target: userId }),
        diff: { deleteFeedback },
      },
    });
    if (subscription)
      await tx.subscription.update({
        where: { userId },
        data: { status: 'canceled', cancelAtPeriodEnd: false },
      });
  });
}
/** Delete due accounts after seven days; cascades remove their profile, readings and shares. */
export async function hardDeleteAccounts(now = new Date()) {
  const db = getDb(),
    before = new Date(now.getTime() - 7 * 86400000);
  return db.$transaction(async (tx) => {
    const due = await tx.user.findMany({
      where: { deletedAt: { lte: before } },
      select: { id: true, email: true },
    });
    for (const user of due) {
      if (user.email) await tx.verificationToken.deleteMany({ where: { identifier: user.email } });
      await tx.user.delete({ where: { id: user.id } });
      // DESIGN-GAP: Scheduled deletion uses the existing audit table with a system actor and no personal target.
      await tx.adminAuditLog.create({
        data: { adminId: 'system:cron', action: 'user.hard_delete' },
      });
    }
    return due.length;
  });
}
/** Constant-time cron bearer comparison, rejecting absent configuration. */
export function cronAuthorized(header: string | null) {
  const expected = process.env.CRON_SECRET
    ? Buffer.from(`Bearer ${process.env.CRON_SECRET}`)
    : null;
  const actual = Buffer.from(header ?? '');
  return Boolean(
    expected && expected.length === actual.length && timingSafeEqual(expected, actual),
  );
}
