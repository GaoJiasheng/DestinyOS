import { atomicBatch, audit, guard, updateRows, insertRow } from './db-batch';
import { z } from 'zod';
import { getDb } from './db';
import { SiteConfigSchema } from './site-config';
import { cacheDelete, cacheRead, cacheWrite } from './cache';
import { getStripe } from './stripe';
import { liveEventCount } from './events';
/** Bounded email/ID search with an explicit safe projection that never selects encrypted columns. */
export async function listUsers(search = '', page = 1) {
  return getDb().user.findMany({
    where: search ? { OR: [{ email: { contains: search } }, { id: { contains: search } }] } : {},
    select: {
      id: true,
      email: true,
      plan: true,
      locale: true,
      createdAt: true,
      lastActiveAt: true,
      deletedAt: true,
      _count: { select: { readings: true } },
    },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    skip: (page - 1) * 50,
    take: 51,
  });
}
/** Admin user details deliberately exclude encBirth/encPlace/encInput; the encryption extension cannot decrypt unselected fields. */
export async function getUser(id: string) {
  return getDb().user.findUniqueOrThrow({
    where: { id },
    select: {
      id: true,
      email: true,
      plan: true,
      locale: true,
      createdAt: true,
      lastActiveAt: true,
      deletedAt: true,
      profiles: {
        select: {
          birthYear: true,
          tz: true,
          gender: true,
          timeUnknown: true,
          version: true,
          isCurrent: true,
        },
        orderBy: { version: 'desc' },
      },
      _count: { select: { readings: true, profiles: true } },
    },
  });
}
/** Change a manual entitlement and audit its old/new plan atomically. */
export async function setPlan(adminId: string, id: string, plan: 'free' | 'pro') {
  const user = await getDb().user.findUniqueOrThrow({
    where: { id },
    select: { plan: true, deletedAt: true },
  });
  if (user.deletedAt) throw new Error('Deleted user');
  await atomicBatch([
    ...guard(
      'EXISTS (SELECT 1 FROM "User" WHERE id=? AND "deletedAt" IS NULL AND plan=?)',
      id,
      user.plan,
    ),
    updateRows('User', { plan }, 'id=?', id),
    audit(adminId, 'user.plan', id, { from: user.plan, to: plan }),
  ]);
}
/** Update configuration and audit it atomically, then invalidate KV. */
export async function setConfig(adminId: string, raw: unknown) {
  const config = SiteConfigSchema.parse(raw);
  const previous = await getDb().siteConfig.findMany();
  await atomicBatch([
    ...Object.entries(config).map(([key, value]) =>
      insertRow(
        'SiteConfig',
        { key, value, updatedBy: adminId },
        'ON CONFLICT(key) DO UPDATE SET value=excluded.value,"updatedBy"=excluded."updatedBy","updatedAt"=excluded."updatedAt"',
      ),
    ),
    audit(adminId, 'config.update', 'SiteConfig', {
      before: Object.fromEntries(previous.map((r) => [r.key, r.value])),
      after: config,
    }),
  ]);
  try {
    await cacheDelete('site-config');
  } catch {
    /* Bounded TTL remains. */
  }
}
/** Moderate feedback and record a birth-free audit in one D1 batch. */
export async function moderateFeedback(
  adminId: string,
  id: string,
  operation: 'delete' | 'process',
) {
  await atomicBatch([
    updateRows(
      'Feedback',
      operation === 'delete' ? { text: null } : { processedAt: new Date() },
      'id=?',
      id,
    ),
    audit(adminId, operation === 'delete' ? 'feedback.delete_text' : 'feedback.process', id),
  ]);
}
const StripeStatsSchema = z.object({
  available: z.boolean(),
  subscribers: z.number(),
  mrr: z.record(z.number()),
});
/** Cache active/trialing Stripe subscription counts and monthly recurring revenue by currency for one hour. */
export async function stripeStats() {
  try {
    const cached = StripeStatsSchema.safeParse(await cacheRead<unknown>('admin:stripe-stats'));
    if (cached.success) return cached.data;
    let subscribers = 0;
    const mrr: Record<string, number> = {};
    for await (const subscription of getStripe().subscriptions.list({
      status: 'all',
      limit: 100,
      expand: ['data.items.data.price'],
    })) {
      if (!['active', 'trialing'].includes(subscription.status)) continue;
      subscribers++;
      // DESIGN-GAP: MRR excludes tax and one-off charges; trialing counts as a subscriber but generates no recognized recurring revenue yet.
      if (subscription.status === 'trialing') continue;
      for (const item of subscription.items.data) {
        const price = item.price;
        if (!price.recurring || price.unit_amount === null) continue;
        const interval: string = price.recurring.interval;
        const monthly: Record<string, number> = {
          month: 1,
          year: 12,
          week: 12 / 52,
          day: 12 / 365,
        };
        const factor = monthly[interval];
        if (!factor) continue;
        const months = factor * price.recurring.interval_count;
        mrr[price.currency] =
          (mrr[price.currency] ?? 0) + (price.unit_amount * (item.quantity ?? 1)) / 100 / months;
      }
    }
    const value = { available: true, subscribers, mrr };
    await cacheWrite('admin:stripe-stats', value, 3600);
    return value;
  } catch {
    return { available: false, subscribers: 0, mrr: {} };
  }
}
/** Read completed-day aggregates and today's authoritative D1 event rows. */
export async function stats(range: 1 | 7 | 30) {
  const today = new Date(new Date().toISOString().slice(0, 10));
  const from = new Date(today.getTime() - (range - 1) * 86400000);
  const rows = await getDb().eventDaily.findMany({ where: { day: { gte: from, lt: today } } });
  const names = [
    'reading.created',
    'reading.failed',
    'daily.viewed',
    'share.created',
    'user.registered',
    'sub.started',
  ] as const;
  const live = await Promise.all(
    names.map(async (name) => [name, await liveEventCount(name)] as const),
  );
  const rawToday = await getDb().event.groupBy({
    by: ['name'],
    where: { day: today, name: { in: [...names] } },
    _count: true,
  });
  const counters = Object.fromEntries(
    names.map((name) => [
      name,
      rows.filter((r) => r.name === name).reduce((total, r) => total + r.count, 0) +
        Math.max(
          live.find(([n]) => n === name)?.[1] ?? 0,
          rawToday.find((row) => row.name === name)?._count ?? 0,
        ),
    ]),
  );
  const dau = await getDb().event.findMany({
    where: { day: today, name: 'user.active', userHash: { not: null } },
    select: { userHash: true },
    distinct: ['userHash'],
  });
  const currentBySystem = await getDb().event.groupBy({
    by: ['system'],
    where: { day: today, name: 'reading.created' },
    _count: true,
  });
  return {
    counters,
    rows,
    dau: dau.length,
    currentBySystem,
    stripe: await stripeStats(),
    liveAvailable: live.every(([, n]) => n !== null),
  };
}
