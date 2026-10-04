import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { getDb } from './db';
import { SiteConfigSchema } from './site-config';
import { cacheDelete, cacheRead, cacheWrite } from './cache';
import { getStripe } from './stripe';
import { liveEventCount } from './events';
/** Bounded email/ID search with an explicit safe projection that never selects encrypted columns. */
export async function listUsers(search = '', page = 1) {
  return getDb().user.findMany({
    where: search
      ? { OR: [{ email: { contains: search, mode: 'insensitive' } }, { id: { contains: search } }] }
      : {},
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
  return getDb().$transaction(async (tx) => {
    const user = await tx.user.findUniqueOrThrow({
      where: { id },
      select: { plan: true, deletedAt: true },
    });
    if (user.deletedAt) throw new Error('Deleted user');
    await tx.user.update({ where: { id }, data: { plan } });
    await tx.adminAuditLog.create({
      data: { adminId, action: 'user.plan', target: id, diff: { from: user.plan, to: plan } },
    });
  });
}
/** Update all supported settings and audit their previous values in the same transaction, then invalidate Redis. */
export async function setConfig(adminId: string, raw: unknown) {
  const config = SiteConfigSchema.parse(raw);
  await getDb().$transaction(async (tx) => {
    const previous = await tx.siteConfig.findMany();
    for (const [key, value] of Object.entries(config)) {
      const data = {
        value: JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue,
        updatedBy: adminId,
      };
      await tx.siteConfig.upsert({ where: { key }, create: { key, ...data }, update: data });
    }
    await tx.adminAuditLog.create({
      data: {
        adminId,
        action: 'config.update',
        target: 'SiteConfig',
        diff: { before: Object.fromEntries(previous.map((r) => [r.key, r.value])), after: config },
      },
    });
  });
  try {
    await cacheDelete('site-config');
  } catch {
    /* Existing cache expires after at most 60s. */
  }
}
/** Delete potentially sensitive feedback text or mark handled, without copying it into audit logs. */
export async function moderateFeedback(
  adminId: string,
  id: string,
  operation: 'delete' | 'process',
) {
  await getDb().$transaction(async (tx) => {
    await tx.feedback.update({
      where: { id },
      data: operation === 'delete' ? { text: null } : { processedAt: new Date() },
    });
    await tx.adminAuditLog.create({
      data: {
        adminId,
        action: operation === 'delete' ? 'feedback.delete_text' : 'feedback.process',
        target: id,
      },
    });
  });
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
/** Read completed-day aggregates and today's Redis counters; today's unique activity is counted in Postgres. */
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
