import { beforeEach, afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import Stripe from 'stripe';
import { isolatedSqlite } from '../../../scripts/sqlite-test';
const mock = vi.hoisted(() => ({ retrieve: vi.fn(), mail: vi.fn(), db: null as unknown }));
vi.mock('../lib/db', () => ({ getDb: () => mock.db }));
vi.mock('../lib/stripe', async (original) => ({
  ...(await original<typeof import('../lib/stripe')>()),
  getStripe: () => ({
    subscriptions: { retrieve: mock.retrieve },
    webhooks: new Stripe('sk_test').webhooks,
  }),
}));
vi.mock('resend', () => ({
  Resend: class {
    emails = { send: mock.mail };
  },
}));
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
  vi.stubEnv('RESEND_API_KEY', 're_test');
  vi.stubEnv('EMAIL_FROM', 'test@example.test');
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
  it('sends a localized idempotent failed-payment reminder', async () => {
    await handleStripeEvent(checkout());
    mock.mail.mockResolvedValue({ error: null });
    await handleStripeEvent(
      event('invoice.payment_failed', { customer: 'cus_test' }, 'evt_failed'),
    );
    expect(mock.mail).toHaveBeenCalledWith(
      expect.objectContaining({ subject: 'Subscription payment failed' }),
      { idempotencyKey: 'evt_failed' },
    );
    expect((await db.user.findUniqueOrThrow({ where: { id: 'owner' } })).plan).toBe('pro');
  });
});
