import { randomUUID } from 'node:crypto';
import type Stripe from 'stripe';
import { createTranslator } from 'next-intl';
import { Resend } from 'resend';
import { getDb } from './db';
import { eventIdentity, incrementEventCounter } from './events';
import { getStripe, subscriptionPlan } from './stripe';
import { getLocalRedis, getUpstashRedis } from './redis';
import { ApiError } from './api-error';
import { toMessages } from '@/i18n/catalog';
import zh from '@/messages/zh.json';
import en from '@/messages/en.json';

async function reserve(key: string, value: string, seconds: number) {
  return process.env.UPSTASH_REDIS_REST_URL
    ? getUpstashRedis().set(key, value, { nx: true, ex: seconds })
    : getLocalRedis().set(key, value, 'EX', seconds, 'NX');
}
async function read(key: string) {
  return process.env.UPSTASH_REDIS_REST_URL
    ? getUpstashRedis().get<string>(key)
    : getLocalRedis().get(key);
}
async function release(key: string, owner: string) {
  const lua =
    "if redis.call('GET', KEYS[1]) == ARGV[1] then return redis.call('DEL', KEYS[1]) else return 0 end";
  if (process.env.UPSTASH_REDIS_REST_URL) await getUpstashRedis().eval(lua, [key], [owner]);
  else await getLocalRedis().eval(lua, 1, key, owner);
}
function objectId(value: string | { id: string } | null): string | null {
  return typeof value === 'string' ? value : (value?.id ?? null);
}
async function synchronize(subscriptionId: string, customerId: string | null, userId?: string) {
  const db = getDb();
  const existing = await db.subscription.findFirst({
    where: {
      OR: [
        { stripeSubscriptionId: subscriptionId },
        ...(customerId ? [{ stripeCustomerId: customerId }] : []),
      ],
    },
  });
  const owner = userId ?? existing?.userId;
  // DESIGN-GAP: Unknown customers are ignored; deletion retries must never resurrect a deleted account.
  if (!owner) return;
  const transition = await db.$transaction(
    async (tx) => {
      // DESIGN-GAP: Serialize subscription changes per owner, then retrieve current Stripe state so out-of-order events cannot restore stale entitlements.
      await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${owner} FOR UPDATE`;
      const user = await tx.user.findUnique({
        where: { id: owner },
        select: { deletedAt: true, plan: true, locale: true },
      });
      if (!user || user.deletedAt) return;
      const sub = await getStripe().subscriptions.retrieve(subscriptionId);
      const customer = objectId(sub.customer);
      if (!customer || (customerId && customer !== customerId))
        throw new ApiError('E_PAYMENT', 'Customer mismatch', 400);
      const item = sub.items.data[0];
      const data = {
        stripeCustomerId: customer,
        stripeSubscriptionId: sub.id,
        stripePriceId: item?.price.id ?? null,
        status: sub.status,
        currentPeriodEnd: item ? new Date(item.current_period_end * 1000) : null,
        cancelAtPeriodEnd: sub.cancel_at_period_end,
      };
      await tx.subscription.upsert({
        where: { userId: owner },
        create: { userId: owner, ...data },
        update: data,
      });
      const plan = subscriptionPlan(sub.status);
      await tx.user.update({ where: { id: owner }, data: { plan } });
      if (plan !== user.plan) {
        await tx.event.create({
          data: {
            ...eventIdentity(owner),
            name: plan === 'pro' ? 'sub.started' : 'sub.ended',
            locale: user.locale,
            plan,
          },
        });
        return plan === 'pro' ? ('sub.started' as const) : ('sub.ended' as const);
      }
    },
    { timeout: 20000 },
  );
  if (transition) await incrementEventCounter(transition);
}
async function processEvent(event: Stripe.Event) {
  switch (event.type) {
    case 'checkout.session.completed': {
      const checkout = event.data.object;
      const subscription = objectId(checkout.subscription);
      if (subscription)
        await synchronize(
          subscription,
          objectId(checkout.customer),
          checkout.client_reference_id ?? checkout.metadata?.userId,
        );
      break;
    }
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted': {
      const sub = event.data.object;
      await synchronize(sub.id, objectId(sub.customer), sub.metadata.userId);
      break;
    }
    case 'invoice.payment_failed': {
      const customer = objectId(event.data.object.customer);
      if (!customer) break;
      const subscription = await getDb().subscription.findUnique({
        where: { stripeCustomerId: customer },
        include: { user: true },
      });
      if (!subscription?.user.email || subscription.user.deletedAt) break;
      // DESIGN-GAP: Missing optional mail credentials skip reminders; billing entitlement remains unchanged.
      if (!process.env.RESEND_API_KEY || !process.env.EMAIL_FROM) break;
      const locale = subscription.user.locale;
      const t = createTranslator({ locale, messages: toMessages(locale === 'zh' ? zh : en) });
      const sent = await new Resend(process.env.RESEND_API_KEY).emails.send(
        {
          from: process.env.EMAIL_FROM,
          to: subscription.user.email,
          subject: t('billing.paymentFailed.subject'),
          text: t('billing.paymentFailed.body'),
        },
        { idempotencyKey: event.id },
      );
      if (sent.error) throw new ApiError('E_PAYMENT', 'Payment reminder failed', 502);
      break;
    }
  }
}
/** Process a verified event once, retaining successful IDs for 24h and allowing failed work to retry. */
export async function handleStripeEvent(event: Stripe.Event): Promise<'processed' | 'duplicate'> {
  const key = `stripe:event:${event.id}`;
  if (await read(key)) return 'duplicate';
  const lock = `${key}:lock`,
    token = randomUUID();
  if (!(await reserve(lock, token, 60)))
    throw new ApiError('E_PAYMENT', 'Webhook processing; retry', 503);
  try {
    if (await read(key)) return 'duplicate';
    await processEvent(event);
    await reserve(key, 'done', 86400);
    return 'processed';
  } finally {
    await release(lock, token);
  }
}
