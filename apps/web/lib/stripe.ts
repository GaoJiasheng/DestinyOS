import Stripe from 'stripe';
import { ApiError } from './api-error';

/** Billing is available only when both documented prices and the server key are configured. */
export function billingEnabled(): boolean {
  return Boolean(
    process.env.STRIPE_SECRET_KEY &&
    process.env.STRIPE_PRICE_MONTHLY &&
    process.env.STRIPE_PRICE_LIFETIME,
  );
}
/** Lazily construct the Stripe client; never expose a key or an SDK error to the browser. */
export function getStripe(): Stripe {
  if (!process.env.STRIPE_SECRET_KEY) throw new ApiError('E_PAYMENT', 'Billing unavailable', 503);
  return new Stripe(process.env.STRIPE_SECRET_KEY, {
    maxNetworkRetries: 2,
    timeout: 10000,
    httpClient: Stripe.createFetchHttpClient(),
  });
}
/** Map Stripe's documented entitlement states to the existing Plan enum. */
export function subscriptionPlan(status: string): 'pro' | 'free' {
  return status === 'active' || status === 'trialing' ? 'pro' : 'free';
}
