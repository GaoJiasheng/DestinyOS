import Stripe from 'stripe';
import { pathToFileURL } from 'node:url';
import { brand } from '../packages/shared/src/brand';

/** Idempotently provision the Owner's fixed USD monthly and lifetime prices and retire annual sales. */
export async function createStripeProducts(stripe: Stripe): Promise<void> {
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
        description: 'digital astrology & tarot content (ad-free), entertainment purposes',
      },
      { idempotencyKey: 'destinyos-pro-product-v1' },
    );
  });
  for (const [kind, amount, lookup] of [
    ['monthly', 299, 'destinyos-pro-monthly'],
    ['lifetime', 699, 'destinyos-pro-lifetime'],
  ] as const) {
    const existing = await stripe.prices.list({ lookup_keys: [lookup], active: true, limit: 1 });
    const found = existing.data[0];
    if (
      found &&
      (found.currency !== 'usd' ||
        found.unit_amount !== amount ||
        (typeof found.product === 'string' ? found.product : found.product.id) !== product.id ||
        (kind === 'monthly'
          ? found.recurring?.interval !== 'month' || found.recurring.interval_count !== 1
          : found.recurring !== null))
    )
      throw new Error(`Existing ${kind} lookup price differs from the Owner's fixed pricing`);
    const price =
      found ??
      (await stripe.prices.create(
        {
          product: product.id,
          currency: 'usd',
          unit_amount: amount,
          ...(kind === 'monthly' ? { recurring: { interval: 'month' as const } } : {}),
          lookup_key: lookup,
        },
        { idempotencyKey: `${lookup}:${amount}` },
      ));
    console.log(
      `${kind === 'monthly' ? 'STRIPE_PRICE_MONTHLY' : 'STRIPE_PRICE_LIFETIME'}=${price.id}`,
    );
  }
  // DESIGN-GAP: Archive annual prices without canceling existing subscribers; operators also remove annual switching in Customer Portal.
  for await (const price of stripe.prices.list({ product: product.id, active: true, limit: 100 })) {
    if (price.recurring?.interval === 'year')
      await stripe.prices.update(price.id, { active: false });
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error('STRIPE_SECRET_KEY is required');
  await createStripeProducts(new Stripe(key));
}
