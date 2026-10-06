'use server';
import { z } from 'zod';
import { getLocale } from 'next-intl/server';
import { brand } from '@tianji/shared';
import { auth } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { billingEnabled, webPaymentsEnabled } from '@/lib/web-payments';
import { ApiError } from '@/lib/api-error';

async function billingUser() {
  const session = await auth();
  if (!session?.user.id) throw new ApiError('E_UNAUTHORIZED', 'Sign in required', 401);
  const user = await getDb().user.findUniqueOrThrow({
    where: { id: session.user.id },
    include: { subscription: true },
  });
  if (user.deletedAt) throw new ApiError('E_UNAUTHORIZED', 'Deleted account', 401);
  return user;
}
function failure(error: unknown) {
  return {
    ok: false as const,
    error: { code: error instanceof ApiError ? error.code : 'E_PAYMENT' },
  };
}
/** Create a hosted monthly subscription or lifetime payment checkout for the authenticated owner and an allowlisted price. */
export async function createCheckoutSessionAction(raw: unknown) {
  try {
    if (!webPaymentsEnabled()) throw new ApiError('E_NOT_FOUND', 'Not found', 404);
    const { price } = z
      .object({ price: z.enum(['monthly', 'lifetime']) })
      .strict()
      .parse(raw);
    if (!billingEnabled()) throw new ApiError('E_PAYMENT', 'Billing unavailable', 503);
    const user = await billingUser();
    if (
      user.lifetime ||
      (price === 'monthly' &&
        (user.plan === 'pro' ||
          (user.subscription?.stripeSubscriptionId &&
            !['canceled', 'incomplete_expired'].includes(user.subscription.status))))
    )
      throw new ApiError('E_PAYMENT', 'Use the billing portal for an existing subscription', 409);
    const locale = await getLocale();
    const base = process.env.NEXT_PUBLIC_SITE_URL ?? `https://${brand.domain}`;
    // DESIGN-GAP: A per-user, ten-minute Stripe idempotency key prevents double clicks creating duplicate checkouts.
    // DESIGN-GAP: Buying lifetime preserves an existing subscription; the UI tells its owner to cancel renewal in Portal.
    const { getStripe } = await import('@/lib/stripe');
    const checkout = await getStripe().checkout.sessions.create(
      {
        mode: price === 'lifetime' ? 'payment' : 'subscription',
        ...(price === 'lifetime' && !user.subscription ? { customer_creation: 'always' } : {}),
        ...(user.subscription
          ? { customer: user.subscription.stripeCustomerId }
          : user.email
            ? { customer_email: user.email }
            : {}),
        client_reference_id: user.id,
        metadata: { userId: user.id, price },
        ...(price === 'monthly' ? { subscription_data: { metadata: { userId: user.id } } } : {}),
        line_items: [
          {
            price:
              price === 'monthly'
                ? process.env.STRIPE_PRICE_MONTHLY
                : process.env.STRIPE_PRICE_LIFETIME,
            quantity: 1,
          },
        ],
        allow_promotion_codes: true,
        automatic_tax: { enabled: process.env.STRIPE_TAX_ENABLED === 'true' },
        ...(process.env.STRIPE_TAX_ENABLED === 'true'
          ? {
              billing_address_collection: 'required' as const,
              ...(user.subscription ? { customer_update: { address: 'auto' as const } } : {}),
            }
          : {}),
        success_url: `${base}/${locale}/me/billing?status=success&purchase=${price}`,
        cancel_url: `${base}/${locale}/pricing?status=canceled`,
      },
      { idempotencyKey: `checkout:${user.id}:${price}:${Math.floor(Date.now() / 600000)}` },
    );
    if (!checkout.url) throw new ApiError('E_PAYMENT', 'Checkout unavailable', 502);
    return { ok: true as const, data: { url: checkout.url } };
  } catch (error) {
    return failure(error);
  }
}
/** Open Stripe Customer Portal for the owner's stored customer only. */
export async function createPortalSessionAction() {
  try {
    if (!webPaymentsEnabled()) throw new ApiError('E_NOT_FOUND', 'Not found', 404);
    const { getStripe } = await import('@/lib/stripe');
    const user = await billingUser();
    if (!user.subscription) throw new ApiError('E_PAYMENT', 'No subscription', 404);
    const locale = await getLocale();
    const portal = await getStripe().billingPortal.sessions.create({
      customer: user.subscription.stripeCustomerId,
      return_url: `${process.env.NEXT_PUBLIC_SITE_URL ?? `https://${brand.domain}`}/${locale}/me/billing`,
    });
    return { ok: true as const, data: { url: portal.url } };
  } catch (error) {
    return failure(error);
  }
}
/** Poll a fresh database plan after Checkout; no card data is returned. */
export async function getBillingAction() {
  try {
    const user = await billingUser();
    return {
      ok: true as const,
      data: {
        plan: user.plan,
        lifetime: user.lifetime,
        status: user.subscription?.status ?? null,
        currentPeriodEnd: user.subscription?.currentPeriodEnd?.toISOString() ?? null,
        cancelAtPeriodEnd: user.subscription?.cancelAtPeriodEnd ?? false,
      },
    };
  } catch (error) {
    return failure(error);
  }
}
