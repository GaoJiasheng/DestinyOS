import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import Stripe from 'stripe';
import RedisMock from 'ioredis-mock';
const mock = vi.hoisted(() => ({
  retrieve: vi.fn(),
  subscription: vi.fn(),
  upsert: vi.fn(),
  user: vi.fn(),
  userUpdate: vi.fn(),
  query: vi.fn(),
  mail: vi.fn(),
  event: vi.fn(),
}));
const redis = new RedisMock();
vi.mock('../lib/redis', () => ({ getLocalRedis: () => redis }));
vi.mock('../lib/db', () => {
  const tx = {
    $queryRaw: mock.query,
    user: { findUnique: mock.user, update: mock.userUpdate },
    subscription: { upsert: mock.upsert },
    event: { create: mock.event },
  };
  return {
    getDb: () => ({
      subscription: { findFirst: mock.subscription, findUnique: mock.subscription },
      $transaction: (work: (value: typeof tx) => Promise<unknown>) => work(tx),
    }),
  };
});
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
beforeEach(async () => {
  vi.clearAllMocks();
  await redis.flushall();
  vi.stubEnv('AUTH_SECRET', 'isolated-unit-event-secret');
  vi.stubEnv('STRIPE_SECRET_KEY', 'sk_test');
  vi.stubEnv('STRIPE_WEBHOOK_SECRET', 'whsec_test');
  vi.stubEnv('UPSTASH_REDIS_REST_URL', '');
  mock.subscription.mockResolvedValue({ userId: 'owner' });
  mock.user.mockResolvedValue({ deletedAt: null, plan: 'free', locale: 'zh' });
  mock.retrieve.mockResolvedValue({
    id: 'sub_test',
    customer: 'cus_test',
    status: 'active',
    cancel_at_period_end: false,
    items: { data: [{ current_period_end: 1800000000, price: { id: 'price_test' } }] },
  });
});
afterEach(() => vi.unstubAllEnvs());
describe('signed Stripe webhooks', () => {
  it('verifies the raw signature and rejects invalid or missing credentials without IO', async () => {
    const body = JSON.stringify(
      event('checkout.session.completed', {
        subscription: 'sub_test',
        customer: 'cus_test',
        client_reference_id: 'owner',
      }),
    );
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
    expect(mock.upsert).not.toHaveBeenCalled();
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
    expect(mock.userUpdate).toHaveBeenCalledWith({ where: { id: 'owner' }, data: { plan: 'pro' } });
    vi.stubEnv('STRIPE_SECRET_KEY', '');
    expect((await POST(new Request('https://example.test', { method: 'POST', body }))).status).toBe(
      503,
    );
  });
  it('deduplicates for 24h and permits failed work to retry', async () => {
    const checkout = event('checkout.session.completed', {
      subscription: 'sub_test',
      customer: 'cus_test',
      client_reference_id: 'owner',
    });
    mock.retrieve.mockRejectedValueOnce(new Error('temporary'));
    await expect(handleStripeEvent(checkout)).rejects.toThrow('temporary');
    expect(await redis.get('stripe:event:evt_test')).toBeNull();
    expect(await handleStripeEvent(checkout)).toBe('processed');
    expect(await handleStripeEvent(checkout)).toBe('duplicate');
    expect(await redis.ttl('stripe:event:evt_test')).toBeGreaterThan(86390);
    expect(mock.upsert).toHaveBeenCalledTimes(1);
  });
  it('returns retryable failure for concurrent delivery and reads latest subscription state', async () => {
    await redis.set('stripe:event:evt_busy:lock', 'busy', 'EX', 60);
    await expect(
      handleStripeEvent(
        event(
          'customer.subscription.updated',
          { id: 'sub_test', customer: 'cus_test', metadata: {} },
          'evt_busy',
        ),
      ),
    ).rejects.toMatchObject({ status: 503 });
    mock.retrieve.mockResolvedValueOnce({
      id: 'sub_test',
      customer: 'cus_test',
      status: 'canceled',
      items: { data: [] },
      cancel_at_period_end: false,
    });
    await handleStripeEvent(
      event('customer.subscription.updated', {
        id: 'sub_test',
        customer: 'cus_test',
        metadata: {},
        status: 'active',
      }),
    );
    expect(mock.userUpdate).toHaveBeenCalledWith({
      where: { id: 'owner' },
      data: { plan: 'free' },
    });
  });
  it('keeps access after scheduled cancellation; removes access when deleted; never resurrects deleted users', async () => {
    mock.retrieve.mockResolvedValueOnce({
      id: 'sub_test',
      customer: 'cus_test',
      status: 'active',
      cancel_at_period_end: true,
      items: { data: [{ current_period_end: 1800000000, price: { id: 'price_test' } }] },
    });
    await handleStripeEvent(
      event('customer.subscription.updated', {
        id: 'sub_test',
        customer: 'cus_test',
        metadata: {},
      }),
    );
    expect(mock.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ update: expect.objectContaining({ cancelAtPeriodEnd: true }) }),
    );
    expect(mock.userUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: { plan: 'pro' } }),
    );
    mock.user.mockResolvedValueOnce({ deletedAt: new Date() });
    await handleStripeEvent(
      event(
        'customer.subscription.deleted',
        { id: 'sub_test', customer: 'cus_test', metadata: {} },
        'evt_deleted',
      ),
    );
    expect(mock.retrieve).toHaveBeenCalledTimes(1);
  });
  it('sends a localized idempotent failed-payment reminder without changing plan', async () => {
    vi.stubEnv('RESEND_API_KEY', 're_test');
    vi.stubEnv('EMAIL_FROM', 'test@example.test');
    mock.subscription.mockResolvedValue({
      user: { email: 'user@example.test', locale: 'en', deletedAt: null },
    });
    mock.mail.mockResolvedValue({ error: null });
    await handleStripeEvent(event('invoice.payment_failed', { customer: 'cus_test' }));
    expect(mock.mail).toHaveBeenCalledWith(
      expect.objectContaining({ subject: 'Subscription payment failed' }),
      { idempotencyKey: 'evt_test' },
    );
    expect(mock.userUpdate).not.toHaveBeenCalled();
  });
});
