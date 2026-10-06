import Stripe from 'stripe';
import { ApiError } from './api-error';

export { billingEnabled, subscriptionPlan } from './web-payments';
/** Lazily construct the Stripe client; never expose a key or an SDK error to the browser. */
export function getStripe(): Stripe {
  if (!process.env.STRIPE_SECRET_KEY) throw new ApiError('E_PAYMENT', 'Billing unavailable', 503);
  return new Stripe(process.env.STRIPE_SECRET_KEY, {
    maxNetworkRetries: 2,
    timeout: 10000,
    httpClient: Stripe.createFetchHttpClient(),
  });
}
