import Stripe from 'stripe';
import { brand } from '../packages/shared/src/brand';
// DESIGN-GAP: Documentation suggests USD 2.99/24.99; operators may override cents before creating prices.
const key = process.env.STRIPE_SECRET_KEY;
if (!key) throw new Error('STRIPE_SECRET_KEY is required');
const stripe = new Stripe(key);
const product = await stripe.products.retrieve('destinyos-pro').catch(async (error: unknown) => {
  if (
    !(error instanceof Stripe.errors.StripeInvalidRequestError) ||
    error.code !== 'resource_missing'
  )
    throw error;
  return stripe.products.create(
    {
      id: 'destinyos-pro',
      name: `${brand.nameZh}会员 / ${brand.nameEn} Pro`,
      description:
        'digital astrology & tarot content subscription (ad-free), entertainment purposes',
    },
    { idempotencyKey: 'destinyos-pro-product-v1' },
  );
});
for (const [interval, amount, lookup] of [
  ['month', 299, 'destinyos-pro-monthly'],
  ['year', 2499, 'destinyos-pro-yearly'],
] as const) {
  const existing = await stripe.prices.list({ lookup_keys: [lookup], active: true, limit: 1 });
  const cents = Number(
    interval === 'month'
      ? (process.env.STRIPE_MONTHLY_CENTS ?? amount)
      : (process.env.STRIPE_YEARLY_CENTS ?? amount),
  );
  if (!Number.isInteger(cents) || cents <= 0)
    throw new Error('Price must be positive integer cents');
  const price =
    existing.data[0] ??
    (await stripe.prices.create(
      {
        product: product.id,
        currency: 'usd',
        unit_amount: cents,
        recurring: { interval },
        lookup_key: lookup,
      },
      { idempotencyKey: `${lookup}:${cents}` },
    ));
  console.log(
    `${interval === 'month' ? 'STRIPE_PRICE_MONTHLY' : 'STRIPE_PRICE_YEARLY'}=${price.id}`,
  );
}
