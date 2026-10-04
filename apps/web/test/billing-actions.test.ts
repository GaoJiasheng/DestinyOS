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
  vi.stubEnv('STRIPE_SECRET_KEY', 'sk_test');
  vi.stubEnv('STRIPE_PRICE_MONTHLY', 'price_month');
  vi.stubEnv('STRIPE_PRICE_YEARLY', 'price_year');
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
  expect((await createCheckoutSessionAction({ price: 'yearly' })).ok).toBe(true);
  expect(mock.checkout).toHaveBeenCalledWith(
    expect.objectContaining({
      customer_email: 'user@example.test',
      mode: 'subscription',
      line_items: [{ price: 'price_year', quantity: 1 }],
      allow_promotion_codes: true,
      automatic_tax: { enabled: true },
      success_url: 'https://example.test/en/me/billing?status=success',
    }),
    expect.objectContaining({ idempotencyKey: expect.stringContaining('checkout:owner:yearly:') }),
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
