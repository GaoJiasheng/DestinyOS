import { fromDbLocale } from './db-locale';
import { randomUUID } from 'node:crypto';
import type Stripe from 'stripe';
import { createTranslator } from 'next-intl';
import { sendEmail } from './platform/email';
import { getDb } from './db';
import { eventIdentity, incrementEventCounter } from './events';
import { getStripe, subscriptionPlan } from './stripe';
import { stateRead as read, stateReserve as reserve, stateRelease as release } from './state';
import { insertRow, updateRows } from './db-batch';
import { mutateBillingOwner } from './billing-owner';
import { syncStripePurchase } from './revenuecat';
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
  let transition: 'sub.started' | 'sub.ended' | undefined;
  const changed = await mutateBillingOwner(owner, async (user) => {
    const sub = await getStripe().subscriptions.retrieve(subscriptionId);
    const customer = objectId(sub.customer);
    if (
      !customer ||
      (customerId && customer !== customerId) ||
      (user.subscription && user.subscription.stripeCustomerId !== customer)
    )
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
    const plan =
      user.lifetime || (user.revenuecatProUntil && user.revenuecatProUntil.getTime() > Date.now())
        ? 'pro'
        : subscriptionPlan(sub.status);
    transition =
      plan === user.plan
        ? undefined
        : plan === 'pro'
          ? ('sub.started' as const)
          : ('sub.ended' as const);
    const updates = [
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
    return updates;
  });
  if (changed) {
    if (transition) await incrementEventCounter(transition);
    await syncStripePurchase(owner, subscriptionId);
  }
}

async function synchronizeLifetime(checkout: Stripe.Checkout.Session) {
  const owner = checkout.client_reference_id ?? checkout.metadata?.userId;
  if (!owner) return;
  let started = false;
  const changed = await mutateBillingOwner(owner, async (user) => {
    // DESIGN-GAP: Re-fetch paid Checkout with line items; unrelated or unpaid one-time checkouts must never grant Pro.
    const paid = await getStripe().checkout.sessions.retrieve(checkout.id, {
      expand: ['line_items'],
    });
    if (
      paid.mode !== 'payment' ||
      paid.payment_status !== 'paid' ||
      paid.metadata?.price !== 'lifetime'
    )
      return [];
    const customer = objectId(paid.customer);
    if (
      !customer ||
      customer !== objectId(checkout.customer) ||
      (paid.client_reference_id ?? paid.metadata?.userId) !== owner ||
      (user.subscription && user.subscription.stripeCustomerId !== customer) ||
      paid.line_items?.data.length !== 1 ||
      paid.line_items.data[0]?.price?.id !== process.env.STRIPE_PRICE_LIFETIME ||
      paid.line_items.data[0]?.quantity !== 1
    )
      throw new ApiError('E_PAYMENT', 'Lifetime checkout mismatch', 400);
    started = user.plan !== 'pro';
    return [
      insertRow(
        'Subscription',
        {
          userId: owner,
          stripeCustomerId: customer,
          stripeCheckoutSessionId: paid.id,
          stripePriceId: process.env.STRIPE_PRICE_LIFETIME,
          lifetime: true,
          status: 'active',
        },
        'ON CONFLICT("userId") DO UPDATE SET lifetime=1,"stripeCheckoutSessionId"=excluded."stripeCheckoutSessionId","updatedAt"=excluded."updatedAt"',
      ),
      updateRows('User', { plan: 'pro', lifetime: true }, 'id=?', owner),
      ...(started
        ? [
            insertRow('Event', {
              ...eventIdentity(owner),
              name: 'sub.started',
              locale: user.locale,
              plan: 'pro',
            }),
          ]
        : []),
    ];
  });
  if (changed) {
    if (started) await incrementEventCounter('sub.started');
    await syncStripePurchase(owner, checkout.id);
  }
}

async function processEvent(event: Stripe.Event) {
  switch (event.type) {
    case 'checkout.session.completed':
    case 'checkout.session.async_payment_succeeded': {
      const checkout = event.data.object;
      if (checkout.mode === 'payment') {
        await synchronizeLifetime(checkout);
        break;
      }
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
      const locale = fromDbLocale(subscription.user.locale);
      const t = createTranslator({
        locale,
        messages: toMessages(locale === 'zh-TW' ? tw : locale !== 'en' ? zh : en),
      });
      try {
        // DESIGN-GAP: Email Service has no send idempotency key; D1 webhook event locks/deduplication remain authoritative, with possible repeat delivery after a post-send crash.
        await sendEmail({
          to: subscription.user.email,
          subject: t('billing.paymentFailed.subject'),
          text: t('billing.paymentFailed.body'),
        });
      } catch {
        throw new ApiError('E_PAYMENT', 'Payment reminder failed', 502);
      }
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
