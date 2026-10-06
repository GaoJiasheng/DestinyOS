import { fromDbLocale } from './db-locale';
import { randomUUID } from 'node:crypto';
import type Stripe from 'stripe';
import { createTranslator } from 'next-intl';
import { Resend } from 'resend';
import { getDb } from './db';
import { eventIdentity, incrementEventCounter } from './events';
import { getStripe, subscriptionPlan } from './stripe';
import { stateRead as read, stateReserve as reserve, stateRelease as release } from './state';
import { atomicBatch, insertRow, updateRows, guard } from './db-batch';
import { ApiError } from './api-error';
import { toMessages } from '@/i18n/catalog';
import zh from '@/messages/zh.json';
import tw from '../messages/zh-TW.json';
import en from '@/messages/en.json';

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
  const ownerLock = `stripe:owner:${owner}`,
    ownerToken = randomUUID();
  if (!(await reserve(ownerLock, ownerToken, 120)))
    throw new ApiError('E_PAYMENT', 'Subscription synchronization in progress; retry', 503);
  try {
    // DESIGN-GAP: Fetch authoritative Stripe state before the batch, then guard the user's updatedAt against competing webhook/delete writes.
    const user = await db.user.findUnique({
      where: { id: owner },
      select: { deletedAt: true, plan: true, locale: true, updatedAt: true },
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
    const plan = subscriptionPlan(sub.status);
    const transition =
      plan === user.plan
        ? undefined
        : plan === 'pro'
          ? ('sub.started' as const)
          : ('sub.ended' as const);
    const updates = [
      ...guard(
        'EXISTS (SELECT 1 FROM "EphemeralState" WHERE key=? AND value=? AND "expiresAt">?)',
        ownerLock,
        ownerToken,
        Date.now(),
      ),
      ...guard(
        'EXISTS (SELECT 1 FROM "User" WHERE id=? AND "deletedAt" IS NULL AND "updatedAt"=?)',
        owner,
        user.updatedAt.toISOString().replace('Z', '+00:00'),
      ),
      insertRow(
        'Subscription',
        { userId: owner, ...data },
        'ON CONFLICT("userId") DO UPDATE SET "stripeCustomerId"=excluded."stripeCustomerId","stripeSubscriptionId"=excluded."stripeSubscriptionId","stripePriceId"=excluded."stripePriceId",status=excluded.status,"currentPeriodEnd"=excluded."currentPeriodEnd","cancelAtPeriodEnd"=excluded."cancelAtPeriodEnd","updatedAt"=excluded."updatedAt"',
      ),
      updateRows('User', { plan }, 'id=?', owner),
      ...(transition
        ? [
            insertRow('Event', {
              ...eventIdentity(owner),
              name: transition,
              locale: user.locale,
              plan,
            }),
          ]
        : []),
    ];
    await atomicBatch(updates);
    if (transition) await incrementEventCounter(transition);
  } finally {
    await release(ownerLock, ownerToken);
  }
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
      const locale = fromDbLocale(subscription.user.locale);
      const t = createTranslator({
        locale,
        messages: toMessages(locale === 'zh-TW' ? tw : locale !== 'en' ? zh : en),
      });
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
