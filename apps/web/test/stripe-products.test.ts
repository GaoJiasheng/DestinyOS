import { afterEach, expect, it, vi } from 'vitest';
import Stripe from 'stripe';
import { createStripeProducts } from '../../../scripts/stripe-products';
afterEach(() => vi.restoreAllMocks());
function response<T>(data: T): Stripe.Response<T> {
  return Object.assign(data as T & object, {
    lastResponse: { headers: {}, requestId: 'req_test', statusCode: 200 },
  });
}
it('creates fixed monthly and non-recurring lifetime prices and archives annual prices', async () => {
  const stripe = new Stripe('sk_test');
  vi.spyOn(stripe.products, 'retrieve').mockResolvedValue(
    response({
      id: 'destinyos-pro',
    } as Stripe.Product),
  );
  const monthly = {
    id: 'price_monthly',
    currency: 'usd',
    unit_amount: 299,
    product: 'destinyos-pro',
    recurring: { interval: 'month', interval_count: 1 },
  } as Stripe.Price;
  const annual = { id: 'price_annual', recurring: { interval: 'year' } } as Stripe.Price;
  const lifetime = {
    id: 'price_lifetime',
    currency: 'usd',
    unit_amount: 699,
    product: 'destinyos-pro',
    recurring: null,
  } as Stripe.Price;
  const list = vi.spyOn(stripe.prices, 'list');
  list.mockImplementation((params) => {
    const data =
      params?.lookup_keys?.[0] === 'destinyos-pro-monthly'
        ? [monthly]
        : params?.lookup_keys
          ? []
          : [annual, monthly, lifetime];
    const page = { object: 'list' as const, data, has_more: false, url: '/v1/prices' };
    return Object.assign(Promise.resolve(response(page)), {
      async *[Symbol.asyncIterator]() {
        yield* data;
      },
      next: async () => ({ done: true as const, value: undefined }),
      autoPagingEach: vi.fn(),
      autoPagingToArray: vi.fn(),
    });
  });
  const create = vi.spyOn(stripe.prices, 'create').mockResolvedValue(response(lifetime));
  const update = vi.spyOn(stripe.prices, 'update').mockResolvedValue(response(annual));
  await createStripeProducts(stripe);
  expect(create).toHaveBeenCalledOnce();
  expect(create).toHaveBeenCalledWith(
    {
      product: 'destinyos-pro',
      currency: 'usd',
      unit_amount: 699,
      lookup_key: 'destinyos-pro-lifetime',
    },
    { idempotencyKey: 'destinyos-pro-lifetime:699' },
  );
  expect(update).toHaveBeenCalledExactlyOnceWith('price_annual', { active: false });
});
it('fails if an existing lookup price disagrees with the Owner decision', async () => {
  const stripe = new Stripe('sk_test');
  vi.spyOn(stripe.products, 'retrieve').mockResolvedValue(
    response({
      id: 'destinyos-pro',
    } as Stripe.Product),
  );
  vi.spyOn(stripe.prices, 'list').mockReturnValue(
    Promise.resolve({
      object: 'list',
      data: [{ id: 'bad', currency: 'usd', unit_amount: 999 }],
      has_more: false,
      url: '/v1/prices',
    }) as ReturnType<Stripe['prices']['list']>,
  );
  await expect(createStripeProducts(stripe)).rejects.toThrow('fixed pricing');
});
