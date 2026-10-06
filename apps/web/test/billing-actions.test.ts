import { beforeEach, afterEach, expect, it, vi } from 'vitest';
const mock = vi.hoisted(() => ({
  auth: vi.fn(),
  user: vi.fn(),
  checkout: vi.fn(),
  portal: vi.fn(),
}));
vi.mock('../lib/auth', () => ({ auth: mock.auth }));
vi.mock('../lib/db', () => ({ getDb: () => ({ user: { findUniqueOrThrow: mock.user } }) }));
vi.mock('next-intl/server', () => ({ getLocale: async () => 'en' }));
vi.mock('../lib/stripe', async (original) => ({
  ...(await original<typeof import('../lib/stripe')>()),
  getStripe: () => ({
    checkout: { sessions: { create: mock.checkout } },
    billingPortal: { sessions: { create: mock.portal } },
  }),
}));
import { createCheckoutSessionAction, createPortalSessionAction } from '../app/billing/actions';
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('FEATURE_WEB_PAYMENTS', 'true');
  vi.stubEnv('STRIPE_SECRET_KEY', 'sk_test');
  vi.stubEnv('STRIPE_PRICE_MONTHLY', 'price_month');
  vi.stubEnv('STRIPE_PRICE_LIFETIME', 'price_lifetime');
  vi.stubEnv('STRIPE_TAX_ENABLED', 'true');
  vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://example.test');
  mock.auth.mockResolvedValue({ user: { id: 'owner' } });
  mock.user.mockResolvedValue({
    id: 'owner',
    email: 'user@example.test',
    deletedAt: null,
    plan: 'free',
    subscription: null,
  });
  mock.checkout.mockResolvedValue({ url: 'https://checkout.stripe.com/test' });
  mock.portal.mockResolvedValue({ url: 'https://billing.stripe.com/test' });
});
afterEach(() => vi.unstubAllEnvs());
it('restricts prices, uses owner email and localized return URLs, and honors Tax toggle', async () => {
  expect((await createCheckoutSessionAction({ price: 'arbitrary' })).ok).toBe(false);
  expect(mock.checkout).not.toHaveBeenCalled();
  expect((await createCheckoutSessionAction({ price: 'monthly' })).ok).toBe(true);
  expect(mock.checkout).toHaveBeenCalledWith(
    expect.objectContaining({
      customer_email: 'user@example.test',
      mode: 'subscription',
      line_items: [{ price: 'price_month', quantity: 1 }],
      allow_promotion_codes: true,
      automatic_tax: { enabled: true },
      success_url: 'https://example.test/en/me/billing?status=success&purchase=monthly',
    }),
    expect.objectContaining({ idempotencyKey: expect.stringContaining('checkout:owner:monthly:') }),
  );
  vi.stubEnv('STRIPE_TAX_ENABLED', 'false');
  await createCheckoutSessionAction({ price: 'monthly' });
  expect(mock.checkout).toHaveBeenLastCalledWith(
    expect.objectContaining({ automatic_tax: { enabled: false } }),
    expect.any(Object),
  );
});
it('fails closed for signed-out/deleted users and degrades without billing credentials', async () => {
  mock.auth.mockResolvedValue(null);
  expect(await createCheckoutSessionAction({ price: 'monthly' })).toMatchObject({
    ok: false,
    error: { code: 'E_UNAUTHORIZED' },
  });
  mock.auth.mockResolvedValue({ user: { id: 'owner' } });
  mock.user.mockResolvedValue({ deletedAt: new Date() });
  expect(await createCheckoutSessionAction({ price: 'monthly' })).toMatchObject({
    ok: false,
    error: { code: 'E_UNAUTHORIZED' },
  });
  vi.stubEnv('STRIPE_SECRET_KEY', '');
  expect(await createCheckoutSessionAction({ price: 'monthly' })).toMatchObject({
    ok: false,
    error: { code: 'E_PAYMENT' },
  });
  expect(mock.checkout).not.toHaveBeenCalled();
});
it('avoids duplicate active subscriptions and opens only the owner customer portal', async () => {
  mock.user.mockResolvedValue({
    id: 'owner',
    plan: 'pro',
    subscription: { stripeCustomerId: 'cus_owner', status: 'active' },
  });
  expect((await createCheckoutSessionAction({ price: 'monthly' })).ok).toBe(false);
  expect((await createPortalSessionAction()).ok).toBe(true);
  expect(mock.portal).toHaveBeenCalledWith({
    customer: 'cus_owner',
    return_url: 'https://example.test/en/me/billing',
  });
});

it('creates lifetime payments with a customer, without subscription_data, and rejects annual or repeat lifetime purchases', async () => {
  expect((await createCheckoutSessionAction({ price: 'yearly' })).ok).toBe(false);
  expect((await createCheckoutSessionAction({ price: 'lifetime' })).ok).toBe(true);
  const input = mock.checkout.mock.calls[0]?.[0] as Record<string, unknown>;
  expect(input).toMatchObject({
    mode: 'payment',
    customer_creation: 'always',
    metadata: { userId: 'owner', price: 'lifetime' },
    line_items: [{ price: 'price_lifetime', quantity: 1 }],
    success_url: 'https://example.test/en/me/billing?status=success&purchase=lifetime',
  });
  expect(input).not.toHaveProperty('subscription_data');
  mock.user.mockResolvedValue({ id: 'owner', lifetime: true, plan: 'pro' });
  expect((await createCheckoutSessionAction({ price: 'lifetime' })).ok).toBe(false);
  expect(mock.checkout).toHaveBeenCalledOnce();
});
it('allows monthly owners to buy lifetime using their existing customer', async () => {
  mock.user.mockResolvedValue({
    id: 'owner',
    lifetime: false,
    plan: 'pro',
    subscription: {
      stripeCustomerId: 'cus_owner',
      stripeSubscriptionId: 'sub_owner',
      status: 'active',
    },
  });
  expect((await createCheckoutSessionAction({ price: 'lifetime' })).ok).toBe(true);
  expect(mock.checkout).toHaveBeenCalledWith(
    expect.objectContaining({ mode: 'payment', customer: 'cus_owner' }),
    expect.any(Object),
  );
  expect(mock.checkout.mock.calls[0]?.[0]).not.toHaveProperty('customer_creation');
});
