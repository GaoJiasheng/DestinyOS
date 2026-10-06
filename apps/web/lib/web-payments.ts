/** Owner switch: the website accepts no payments unless explicitly enabled. */
export function webPaymentsEnabled(): boolean {
  return process.env.FEATURE_WEB_PAYMENTS === 'true';
}
/** Prices are optional while web payments are disabled. This module never loads Stripe. */
export function billingEnabled(): boolean {
  return (
    webPaymentsEnabled() &&
    Boolean(
      process.env.STRIPE_SECRET_KEY &&
      process.env.STRIPE_PRICE_MONTHLY &&
      process.env.STRIPE_PRICE_LIFETIME,
    )
  );
}
/** Map subscription status without loading a payment provider SDK. */
export function subscriptionPlan(status: string): 'pro' | 'free' {
  return status === 'active' || status === 'trialing' ? 'pro' : 'free';
}
