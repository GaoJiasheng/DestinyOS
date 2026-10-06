import { createHmac } from 'node:crypto';
import { beforeEach, afterEach, afterAll, expect, it, vi } from 'vitest';
import { isolatedSqlite } from '../../../scripts/sqlite-test';
const mock = vi.hoisted(() => ({ db: null as unknown }));
vi.mock('../lib/db', () => ({ getDb: () => mock.db }));
import { syncStripePurchase } from '../lib/revenuecat';
import { logger } from '../lib/logger';
import { POST } from '../app/api/v1/mobile/webhooks/revenuecat/route';
const fixture = isolatedSqlite(),
  db = fixture.client;
mock.db = db;
function notification(
  id = 'rc_test',
  type = 'INITIAL_PURCHASE',
  timestamp = Math.floor(Date.now() / 1000),
) {
  const body = JSON.stringify({
    event: { id, type, app_user_id: 'owner', entitlement_ids: ['pro'] },
  });
  return new Request('https://example.test/api/v1/mobile/webhooks/revenuecat', {
    method: 'POST',
    body,
    headers: {
      'X-RevenueCat-Webhook-Signature': `t=${timestamp},v1=${createHmac('sha256', 'rc_signing').update(`${timestamp}.${body}`).digest('hex')}`,
    },
  });
}
function customer(expires: string | null | undefined, grace: string | null = null) {
  return Response.json({
    subscriber: {
      entitlements:
        expires === undefined
          ? {}
          : { pro: { expires_date: expires, grace_period_expires_date: grace } },
    },
  });
}
beforeEach(async () => {
  vi.stubEnv('REVENUECAT_WEBHOOK_SECRET', 'rc_signing');
  vi.stubEnv('REVENUECAT_SECRET_KEY', 'rc_secret');
  await db.ephemeralState.deleteMany();
  await db.user.deleteMany();
  await db.user.create({ data: { id: 'owner', locale: 'en' } });
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});
afterAll(async () => {
  await db.$disconnect();
  await fixture.close();
});
it('fails closed for missing, altered or stale HMAC before any mutation', async () => {
  const fetcher = vi.spyOn(globalThis, 'fetch');
  expect(
    (await POST(new Request('https://example.test', { method: 'POST', body: '{}' }))).status,
  ).toBe(401);
  const altered = notification();
  expect(
    (await POST(new Request(altered.url, { method: 'POST', body: '{}', headers: altered.headers })))
      .status,
  ).toBe(401);
  expect(
    (await POST(notification('rc_old', 'INITIAL_PURCHASE', Math.floor(Date.now() / 1000) - 301)))
      .status,
  ).toBe(401);
  vi.stubEnv('REVENUECAT_WEBHOOK_SECRET', '');
  expect((await POST(notification())).status).toBe(503);
  expect(fetcher).not.toHaveBeenCalled();
  expect((await db.user.findUniqueOrThrow({ where: { id: 'owner' } })).plan).toBe('free');
});
it('deduplicates IDs and grants current pro even for delayed expiration/cancellation events', async () => {
  const expiry = new Date(Date.now() + 86400000).toISOString();
  const fetcher = vi.spyOn(globalThis, 'fetch').mockResolvedValue(customer(expiry));
  expect((await POST(notification('rc_active', 'EXPIRATION'))).status).toBe(200);
  expect(await db.user.findUniqueOrThrow({ where: { id: 'owner' } })).toMatchObject({
    plan: 'pro',
    revenuecatProUntil: new Date(expiry),
    lifetime: false,
  });
  expect(await (await POST(notification('rc_active'))).json()).toMatchObject({
    data: { result: 'duplicate' },
  });
  expect(fetcher).toHaveBeenCalledOnce();
  expect(fetcher).toHaveBeenCalledWith(
    'https://api.revenuecat.com/v1/subscribers/owner',
    expect.objectContaining({
      headers: expect.objectContaining({ Authorization: 'Bearer rc_secret' }),
    }),
  );
  fetcher.mockResolvedValue(customer(undefined));
  await POST(notification('rc_expired', 'EXPIRATION'));
  expect((await db.user.findUniqueOrThrow({ where: { id: 'owner' } })).plan).toBe('free');
});
it('honors billing grace and never downgrades Stripe lifetime or an active Stripe subscription', async () => {
  const expired = new Date(Date.now() - 86400000).toISOString();
  const grace = new Date(Date.now() + 86400000).toISOString();
  const fetcher = vi.spyOn(globalThis, 'fetch').mockResolvedValue(customer(expired, grace));
  await POST(notification());
  expect((await db.user.findUniqueOrThrow({ where: { id: 'owner' } })).plan).toBe('pro');
  await db.subscription.create({
    data: {
      userId: 'owner',
      stripeCustomerId: 'cus_owner',
      stripeSubscriptionId: 'sub_owner',
      status: 'active',
    },
  });
  fetcher.mockResolvedValue(customer(undefined));
  await POST(notification('rc_no_pro'));
  expect((await db.user.findUniqueOrThrow({ where: { id: 'owner' } })).plan).toBe('pro');
  await db.subscription.update({
    where: { userId: 'owner' },
    data: { status: 'canceled', lifetime: true },
  });
  await db.user.update({ where: { id: 'owner' }, data: { lifetime: true } });
  await POST(notification('rc_lifetime'));
  expect(await db.user.findUniqueOrThrow({ where: { id: 'owner' } })).toMatchObject({
    plan: 'pro',
    lifetime: true,
  });
});
it('grants non-expiring pro and retries API failure without marking the event processed', async () => {
  const fetcher = vi
    .spyOn(globalThis, 'fetch')
    .mockResolvedValueOnce(new Response('{}', { status: 503 }))
    .mockResolvedValue(customer(null));
  expect((await POST(notification())).status).toBe(503);
  expect(
    await db.ephemeralState.findUnique({ where: { key: 'revenuecat:event:rc_test' } }),
  ).toBeNull();
  expect((await POST(notification())).status).toBe(200);
  expect(await db.user.findUniqueOrThrow({ where: { id: 'owner' } })).toMatchObject({
    plan: 'pro',
    lifetime: true,
  });
  expect(fetcher).toHaveBeenCalledTimes(2);
});
it('does not resurrect deleted accounts and returns retryable errors for concurrent work', async () => {
  const fetcher = vi.spyOn(globalThis, 'fetch').mockResolvedValue(customer(null));
  await db.ephemeralState.create({
    data: { key: 'revenuecat:event:rc_test:lock', value: 'busy', expiresAt: Date.now() + 60000 },
  });
  expect((await POST(notification())).status).toBe(503);
  expect(fetcher).not.toHaveBeenCalled();
  await db.user.update({ where: { id: 'owner' }, data: { deletedAt: new Date() } });
  expect((await POST(notification('rc_deleted'))).status).toBe(200);
  expect(fetcher).not.toHaveBeenCalled();
  expect((await db.user.findUniqueOrThrow({ where: { id: 'owner' } })).plan).toBe('free');
});

it('skips receipt imports and logs only a configuration reason when the RevenueCat secret is missing', async () => {
  vi.stubEnv('REVENUECAT_SECRET_KEY', '');
  const fetcher = vi.spyOn(globalThis, 'fetch');
  const warning = vi.spyOn(logger, 'warn');
  await syncStripePurchase('owner', 'cs_purchase');
  expect(fetcher).not.toHaveBeenCalled();
  expect(warning).toHaveBeenCalledWith(
    { provider: 'revenuecat', reason: 'missing_secret_key' },
    'Stripe purchase sync skipped',
  );
});
