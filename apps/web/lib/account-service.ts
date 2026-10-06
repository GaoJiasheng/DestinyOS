import { webPaymentsEnabled } from './web-payments';
import { fromDbLocale } from './db-locale';
import { timingSafeEqual } from 'node:crypto';
import { BirthInputSchema } from '@tianji/shared';
import { getDb } from './db';
import { decryptField } from './crypto';
import { ApiError } from './api-error';
import { stateReserve } from './state';
import { atomicBatch, updateRows, statement, audit } from './db-batch';
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
  const chatMessages = await db.chatMessage.findMany({
    where: { reading: { userId } },
    orderBy: { createdAt: 'asc' },
  });
  const journalEntries = await db.journalEntry.findMany({
    where: { userId },
    orderBy: { date: 'desc' },
  });
  const subscription = await db.subscription.findUnique({
    where: { userId },
    select: { status: true, currentPeriodEnd: true, cancelAtPeriodEnd: true },
  });
  return {
    user: { ...user, locale: fromDbLocale(user.locale) },
    profiles: profiles.map((p) => ({
      id: p.id,
      label: p.label,
      isDefault: p.isDefault,
      relation: p.relation,
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
      profileId: r.profileId,
      partnerProfileId: r.partnerProfileId,
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
    chatMessages: chatMessages.map((m) => ({
      readingId: m.readingId,
      role: m.role,
      content: decryptField(m.content, 'ChatMessage.content', userId),
      tokens: m.tokens,
      createdAt: m.createdAt,
    })),
    journalEntries: journalEntries.map((entry) => ({
      ...entry,
      date: entry.date.toISOString().slice(0, 10),
    })),
    subscription,
  };
}
/** Enforce the documented export quota with one atomic D1 reservation. */
export async function reserveExport(userId: string) {
  const key = `export:${userId}`;
  const result = await stateReserve(key, '1', 600);
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
  // DESIGN-GAP: With web payments off, account deletion performs no Stripe calls; Owner manages any legacy renewal in Stripe directly.
  if (
    webPaymentsEnabled() &&
    subscription?.stripeSubscriptionId &&
    subscription.status !== 'canceled'
  ) {
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
  const now = new Date();
  await atomicBatch([
    updateRows('User', { deletedAt: now, plan: 'free' }, 'id=?', userId),
    statement('DELETE FROM "Session" WHERE "userId"=?', userId),
    statement('DELETE FROM "MobileSession" WHERE "userId"=?', userId),
    statement('DELETE FROM "JournalEntry" WHERE "userId"=?', userId),
    updateRows('ShareLink', { revokedAt: now }, '"userId"=? AND "revokedAt" IS NULL', userId),
    updateRows('Reading', { isPublic: false }, '"userId"=?', userId),
    deleteFeedback
      ? statement('DELETE FROM "Feedback" WHERE "userId"=?', userId)
      : updateRows('Feedback', { userId: null, readingId: null }, '"userId"=?', userId),
    audit(actor, 'user.soft_delete', actor === 'system:account' ? undefined : userId, {
      deleteFeedback,
    }),
    ...(subscription
      ? [
          updateRows(
            'Subscription',
            { status: 'canceled', cancelAtPeriodEnd: false },
            '"userId"=?',
            userId,
          ),
        ]
      : []),
  ]);
}
/** Delete due accounts after seven days; cascades remove their profile, readings and shares. */
export async function hardDeleteAccounts(now = new Date()) {
  const db = getDb(),
    before = new Date(now.getTime() - 7 * 86400000);
  const due = await db.user.findMany({
    where: { deletedAt: { lte: before } },
    select: { id: true },
  });
  for (const user of due)
    await atomicBatch([
      statement(
        'DELETE FROM "VerificationToken" WHERE identifier IN (SELECT email FROM "User" WHERE id=? AND "deletedAt" <= ?)',
        user.id,
        before.toISOString().replace('Z', '+00:00'),
      ),
      statement(
        'DELETE FROM "User" WHERE id=? AND "deletedAt" <= ?',
        user.id,
        before.toISOString().replace('Z', '+00:00'),
      ),
      audit('system:cron', 'user.hard_delete'),
    ]);
  return due.length;
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
