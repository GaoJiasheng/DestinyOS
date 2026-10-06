import { beforeEach, afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import Stripe from 'stripe';
import { isolatedSqlite } from '../../../scripts/sqlite-test';
const mock = vi.hoisted(() => ({
  retrieve: vi.fn(),
  checkout: vi.fn(),
  mail: vi.fn(),
  db: null as unknown,
}));
vi.mock('../lib/db', () => ({ getDb: () => mock.db }));
vi.mock('../lib/stripe', async (original) => ({
  ...(await original<typeof import('../lib/stripe')>()),
  getStripe: () => ({
    subscriptions: { retrieve: mock.retrieve },
    checkout: { sessions: { retrieve: mock.checkout } },
    webhooks: new Stripe('sk_test').webhooks,
  }),
}));
vi.mock('../lib/platform/email', () => ({ sendEmail: mock.mail }));
import { handleStripeEvent } from '../lib/stripe-webhook';
import { POST } from '../app/api/v1/stripe/webhook/route';
const fixture = isolatedSqlite();
const db = fixture.client;
mock.db = db;
function event(type: string, object: object, id = 'evt_test'): Stripe.Event {
  return JSON.parse(
    JSON.stringify({
      id,
      object: 'event',
      created: 1,
      type,
      livemode: false,
      pending_webhooks: 1,
      data: { object },
    }),
  ) as Stripe.Event;
}
const checkout = () =>
  event('checkout.session.completed', {
    subscription: 'sub_test',
    customer: 'cus_test',
    client_reference_id: 'owner',
  });
beforeEach(async () => {
  vi.clearAllMocks();
  vi.stubEnv('AUTH_SECRET', 'isolated-unit-event-secret');
  vi.stubEnv('STRIPE_SECRET_KEY', 'sk_test');
  vi.stubEnv('STRIPE_WEBHOOK_SECRET', 'whsec_test');
  vi.stubEnv('STRIPE_PRICE_LIFETIME', 'price_lifetime');
  vi.stubEnv('REVENUECAT_SECRET_KEY', '');
  vi.stubEnv('REVENUECAT_STRIPE_API_KEY', '');
  mock.mail.mockResolvedValue(undefined);
  await db.ephemeralState.deleteMany();
  await db.user.deleteMany();
  await db.event.deleteMany();
  await db.user.create({ data: { id: 'owner', email: 'user@example.test', locale: 'en' } });
  mock.retrieve.mockResolvedValue({
    id: 'sub_test',
    customer: 'cus_test',
    status: 'active',
    cancel_at_period_end: false,
    items: { data: [{ current_period_end: 1800000000, price: { id: 'price_test' } }] },
  });
});
afterEach(() => vi.unstubAllEnvs());
afterAll(async () => {
  await db.$disconnect();
  await fixture.close();
});
describe('signed Stripe webhooks on SQLite', () => {
  it('verifies raw signatures and refuses invalid/missing credentials before mutation', async () => {
    const body = JSON.stringify(checkout());
    const signature = new Stripe('sk_test').webhooks.generateTestHeaderString({
      payload: body,
      secret: 'whsec_test',
    });
    expect(
      (
        await POST(
          new Request('https://example.test', {
            method: 'POST',
            body,
            headers: { 'stripe-signature': 'bad' },
          }),
        )
      ).status,
    ).toBe(400);
    expect(await db.subscription.count()).toBe(0);
    expect(
      (
        await POST(
          new Request('https://example.test', {
            method: 'POST',
            body,
            headers: { 'stripe-signature': signature },
          }),
        )
      ).status,
    ).toBe(200);
    expect((await db.user.findUniqueOrThrow({ where: { id: 'owner' } })).plan).toBe('pro');
    vi.stubEnv('STRIPE_SECRET_KEY', '');
    expect((await POST(new Request('https://example.test', { method: 'POST', body }))).status).toBe(
      503,
    );
  });
  it('deduplicates for 24 hours, releases failed reservations and permits retries', async () => {
    mock.retrieve.mockRejectedValueOnce(new Error('temporary'));
    await expect(handleStripeEvent(checkout())).rejects.toThrow('temporary');
    expect(
      await db.ephemeralState.findUnique({ where: { key: 'stripe:event:evt_test' } }),
    ).toBeNull();
    expect(await handleStripeEvent(checkout())).toBe('processed');
    expect(await handleStripeEvent(checkout())).toBe('duplicate');
    expect(
      (await db.ephemeralState.findUniqueOrThrow({ where: { key: 'stripe:event:evt_test' } }))
        .expiresAt,
    ).toBeGreaterThan(Date.now() + 86390000);
    expect(await db.subscription.count()).toBe(1);
    expect(await db.event.count({ where: { name: 'sub.started' } })).toBe(1);
  });
  it('returns a retryable error for concurrent delivery and retrieves current subscription status', async () => {
    await db.ephemeralState.create({
      data: { key: 'stripe:event:evt_busy:lock', value: 'busy', expiresAt: Date.now() + 60000 },
    });
    await expect(
      handleStripeEvent(
        event(
          'customer.subscription.updated',
          { id: 'sub_test', customer: 'cus_test', metadata: { userId: 'owner' } },
          'evt_busy',
        ),
      ),
    ).rejects.toMatchObject({ status: 503 });
    await handleStripeEvent(checkout());
    mock.retrieve.mockResolvedValueOnce({
      id: 'sub_test',
      customer: 'cus_test',
      status: 'canceled',
      cancel_at_period_end: false,
      items: { data: [] },
    });
    await handleStripeEvent(
      event(
        'customer.subscription.updated',
        { id: 'sub_test', customer: 'cus_test', metadata: {} },
        'evt_end',
      ),
    );
    expect((await db.user.findUniqueOrThrow({ where: { id: 'owner' } })).plan).toBe('free');
    expect(await db.event.count({ where: { name: 'sub.ended' } })).toBe(1);
  });
  it('keeps scheduled cancellation active and never resurrects a deleted account', async () => {
    mock.retrieve.mockResolvedValueOnce({
      id: 'sub_test',
      customer: 'cus_test',
      status: 'active',
      cancel_at_period_end: true,
      items: { data: [] },
    });
    await handleStripeEvent(checkout());
    expect(
      (await db.subscription.findUniqueOrThrow({ where: { userId: 'owner' } })).cancelAtPeriodEnd,
    ).toBe(true);
    await db.user.update({ where: { id: 'owner' }, data: { deletedAt: new Date(), plan: 'free' } });
    await handleStripeEvent(
      event(
        'customer.subscription.deleted',
        { id: 'sub_test', customer: 'cus_test', metadata: {} },
        'evt_deleted',
      ),
    );
    expect(mock.retrieve).toHaveBeenCalledTimes(1);
    expect((await db.user.findUniqueOrThrow({ where: { id: 'owner' } })).plan).toBe('free');
  });
  it.each([
    ['en', 'Subscription payment failed'],
    ['zh', '订阅付款未成功'],
  ] as const)(
    'sends a localized, deduplicated %s failed-payment reminder',
    async (locale, subject) => {
      await db.user.update({ where: { id: 'owner' }, data: { locale } });
      await handleStripeEvent(checkout());
      await handleStripeEvent(
        event('invoice.payment_failed', { customer: 'cus_test' }, 'evt_failed'),
      );
      expect(mock.mail).toHaveBeenCalledWith(
        expect.objectContaining({ subject, to: 'user@example.test', text: expect.any(String) }),
      );
      expect(
        await handleStripeEvent(
          event('invoice.payment_failed', { customer: 'cus_test' }, 'evt_failed'),
        ),
      ).toBe('duplicate');
      expect(mock.mail).toHaveBeenCalledOnce();
      expect((await db.user.findUniqueOrThrow({ where: { id: 'owner' } })).plan).toBe('pro');
    },
  );
  it('retries failed reminders without changing entitlement and ignores deleted recipients', async () => {
    await handleStripeEvent(checkout());
    const failed = event('invoice.payment_failed', { customer: 'cus_test' }, 'evt_mail_retry');
    mock.mail.mockRejectedValueOnce(new Error('E_DAILY_LIMIT_EXCEEDED'));
    await expect(handleStripeEvent(failed)).rejects.toMatchObject({
      code: 'E_PAYMENT',
      status: 502,
    });
    expect(
      await db.ephemeralState.findUnique({ where: { key: 'stripe:event:evt_mail_retry' } }),
    ).toBeNull();
    expect((await db.user.findUniqueOrThrow({ where: { id: 'owner' } })).plan).toBe('pro');
    expect(await handleStripeEvent(failed)).toBe('processed');
    expect(mock.mail).toHaveBeenCalledTimes(2);
    await db.user.update({ where: { id: 'owner' }, data: { deletedAt: new Date() } });
    await handleStripeEvent(
      event('invoice.payment_failed', { customer: 'cus_test' }, 'evt_deleted_mail'),
    );
    expect(mock.mail).toHaveBeenCalledTimes(2);
  });
});

const lifetimeCheckout = () =>
  event(
    'checkout.session.completed',
    {
      id: 'cs_lifetime',
      mode: 'payment',
      customer: 'cus_test',
      client_reference_id: 'owner',
      metadata: { userId: 'owner', price: 'lifetime' },
      payment_status: 'paid',
    },
    'evt_lifetime',
  );
function paidCheckout() {
  return {
    id: 'cs_lifetime',
    mode: 'payment',
    payment_status: 'paid',
    customer: 'cus_test',
    client_reference_id: 'owner',
    metadata: { price: 'lifetime', userId: 'owner' },
    line_items: { data: [{ price: { id: 'price_lifetime' }, quantity: 1 }] },
  };
}
it('grants a paid one-time lifetime once and preserves it after subscription cancellation', async () => {
  await handleStripeEvent(checkout());
  mock.checkout.mockResolvedValue(paidCheckout());
  expect(await handleStripeEvent(lifetimeCheckout())).toBe('processed');
  expect(await handleStripeEvent(lifetimeCheckout())).toBe('duplicate');
  expect(await db.user.findUniqueOrThrow({ where: { id: 'owner' } })).toMatchObject({
    plan: 'pro',
    lifetime: true,
  });
  expect(await db.subscription.findUniqueOrThrow({ where: { userId: 'owner' } })).toMatchObject({
    lifetime: true,
    stripeCheckoutSessionId: 'cs_lifetime',
    stripeSubscriptionId: 'sub_test',
  });
  mock.retrieve.mockResolvedValue({
    id: 'sub_test',
    customer: 'cus_test',
    status: 'canceled',
    cancel_at_period_end: false,
    items: { data: [] },
  });
  await handleStripeEvent(
    event(
      'customer.subscription.deleted',
      { id: 'sub_test', customer: 'cus_test', metadata: {} },
      'evt_lifetime_cancel',
    ),
  );
  expect(await db.user.findUniqueOrThrow({ where: { id: 'owner' } })).toMatchObject({
    plan: 'pro',
    lifetime: true,
  });
  expect(await db.event.count({ where: { name: 'sub.ended' } })).toBe(0);
});
it('does not grant unpaid or unrelated one-time purchases and retries delayed payment success', async () => {
  mock.checkout.mockResolvedValue({ ...paidCheckout(), payment_status: 'unpaid' });
  await handleStripeEvent(lifetimeCheckout());
  expect(await db.subscription.count()).toBe(0);
  mock.checkout.mockResolvedValue({
    ...paidCheckout(),
    line_items: { data: [{ price: { id: 'wrong_price' }, quantity: 1 }] },
  });
  const delayed = event(
    'checkout.session.async_payment_succeeded',
    lifetimeCheckout().data.object,
    'evt_delayed',
  );
  await expect(handleStripeEvent(delayed)).rejects.toMatchObject({ code: 'E_PAYMENT' });
  mock.checkout.mockResolvedValue(paidCheckout());
  await handleStripeEvent(delayed);
  expect(await db.user.findUniqueOrThrow({ where: { id: 'owner' } })).toMatchObject({
    plan: 'pro',
    lifetime: true,
  });
  expect(await db.subscription.findUniqueOrThrow({ where: { userId: 'owner' } })).toMatchObject({
    stripeSubscriptionId: null,
    currentPeriodEnd: null,
    lifetime: true,
  });
});
it('retries RevenueCat imports after committing local lifetime, without duplicate transitions', async () => {
  vi.stubEnv('REVENUECAT_SECRET_KEY', 'rc_secret');
  const fetcher = vi
    .spyOn(globalThis, 'fetch')
    .mockResolvedValueOnce(new Response('{}', { status: 503 }))
    .mockResolvedValue(new Response('{}'));
  try {
    mock.checkout.mockResolvedValue(paidCheckout());
    await expect(handleStripeEvent(lifetimeCheckout())).rejects.toMatchObject({ status: 503 });
    expect((await db.user.findUniqueOrThrow({ where: { id: 'owner' } })).lifetime).toBe(true);
    expect(await handleStripeEvent(lifetimeCheckout())).toBe('processed');
    expect(await db.event.count({ where: { name: 'sub.started' } })).toBe(1);
    expect(fetcher).toHaveBeenLastCalledWith(
      'https://api.revenuecat.com/v1/receipts',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer rc_secret',
          'X-Platform': 'stripe',
        }),
        body: JSON.stringify({ app_user_id: 'owner', fetch_token: 'cs_lifetime' }),
      }),
    );
  } finally {
    fetcher.mockRestore();
  }
});
it('imports monthly purchases using subscription IDs and skips deleted lifetime owners', async () => {
  vi.stubEnv('REVENUECAT_SECRET_KEY', 'rc_secret');
  const fetcher = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}'));
  try {
    await handleStripeEvent(checkout());
    expect(fetcher).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        body: JSON.stringify({ app_user_id: 'owner', fetch_token: 'sub_test' }),
      }),
    );
    await db.user.update({ where: { id: 'owner' }, data: { deletedAt: new Date(), plan: 'free' } });
    await handleStripeEvent(lifetimeCheckout());
    expect(mock.checkout).not.toHaveBeenCalled();
    expect(fetcher).toHaveBeenCalledOnce();
  } finally {
    fetcher.mockRestore();
  }
});
