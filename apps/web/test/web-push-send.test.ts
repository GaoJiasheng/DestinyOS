import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { isolatedSqlite } from '../../../scripts/sqlite-test';
import { fieldEncryptionExtension } from '../lib/db-encryption';
import {
  copy,
  eightAm,
  endpoint,
  pushService,
  stubPushEnvironment,
  subscriptionInput,
  type PushDevice,
  type PushVapid,
} from './web-push-fixture';

const state = vi.hoisted(() => ({
  db: undefined as unknown,
  auth: vi.fn(),
  circuit: new Map<string, string>(),
  limited: false,
}));
vi.mock('../lib/db', () => ({ getDb: () => state.db }));
vi.mock('../lib/auth', () => ({ auth: state.auth }));
vi.mock('../lib/circuit', () => ({
  circuitStore: async () => ({
    get: async (key: string) => state.circuit.get(key) ?? null,
    put: async () => undefined,
  }),
}));
vi.mock('../lib/ratelimit', () => ({
  ratelimit: async () => ({ success: !state.limited }),
  assertRateLimit: (result: { success: boolean }) => {
    if (!result.success) throw new ApiError('E_RATE_LIMITED', 'limited', 429);
  },
}));
vi.mock('../i18n/get-copy', () => ({
  getCopy: async (locale: string) => (key: string) => `${locale}:${key}`,
}));

import { ApiError } from '../lib/api-error';
import { MAX_PUSH_FAILURES, reminderPayload } from '../lib/web-push-schedule';
import { decryptPushPayload } from '../lib/web-push';
import { savePushSubscription, sendDueReminders } from '../lib/web-push-service';
import { GET as cronRoute } from '../app/api/v1/cron/web-push/route';
import {
  pushStatusAction,
  subscribePushAction,
  unsubscribePushAction,
} from '../app/me/push-actions';

const database = isolatedSqlite();
const raw: PrismaClient = database.client;
function extend(client: PrismaClient) {
  return client.$extends(fieldEncryptionExtension());
}
state.db = extend(raw);
let vapid: PushVapid;
let device: PushDevice;
const subscription = (name: string, extra: Record<string, unknown> = {}) =>
  subscriptionInput(device, name, extra);
/** Bypasses savePushSubscription's wall clock so tests choose lastSentDate themselves. */
async function seed(name: string, extra: Record<string, unknown> = {}, userId = 'owner') {
  await savePushSubscription(userId, subscription(name, extra));
  await raw.pushSubscription.updateMany({
    where: { userId, tz: (extra.tz as string | undefined) ?? 'Asia/Shanghai' },
    data: { lastSentDate: null },
  });
}
const run = (fetcher: typeof fetch, extra: Record<string, unknown> = {}) =>
  sendDueReminders({ vapid, copy, now: eightAm, fetch: fetcher, ...extra });
const cron = (secret = 'cron-secret') =>
  cronRoute(
    new Request('https://example.test/api/v1/cron/web-push', {
      headers: { authorization: `Bearer ${secret}` },
    }),
  );

beforeEach(async () => {
  ({ vapid, device } = await stubPushEnvironment());
  state.circuit.clear();
  state.limited = false;
  state.auth.mockResolvedValue({ user: { id: 'owner' } });
  await raw.pushSubscription.deleteMany();
  await raw.ephemeralState.deleteMany();
  await raw.user.deleteMany();
  await raw.user.create({ data: { id: 'owner', email: 'owner@example.test' } });
  await raw.user.create({ data: { id: 'other', email: 'other@example.test' } });
});
afterEach(() => vi.useRealTimers());
afterAll(async () => {
  await raw.$disconnect();
  await database.close();
  vi.unstubAllEnvs();
});

describe('sending', () => {
  it('delivers an encrypted generic payload with no personal data', async () => {
    await seed('a', { locale: 'zh-TW' });
    const { deliveries, fetcher } = pushService();
    expect(await run(fetcher)).toEqual({
      claimed: 1,
      sent: 1,
      gone: 0,
      failed: 0,
      truncated: false,
    });
    expect(deliveries[0]?.url).toBe(endpoint('a'));
    const plain = new TextDecoder().decode(
      await decryptPushPayload(deliveries[0]!.body, device.receiver, device.auth),
    );
    expect(plain).toBe(reminderPayload('zh-TW', copy['zh-TW']));
    expect(Object.keys(JSON.parse(plain)).sort()).toEqual(['body', 'tag', 'title', 'url']);
    expect(JSON.parse(plain).url).toBe('/zh-TW/today');
  });

  it('is idempotent across repeated and concurrent runs on the same local day', async () => {
    await seed('a');
    await seed('b');
    const { deliveries, fetcher } = pushService();
    await Promise.all([run(fetcher), run(fetcher)]);
    expect(deliveries.map((entry) => entry.url).sort()).toEqual([endpoint('a'), endpoint('b')]);
    expect((await run(fetcher)).claimed).toBe(0);
    expect(deliveries).toHaveLength(2);
    const rows = await raw.pushSubscription.findMany();
    expect(rows.map((row) => row.lastSentDate)).toEqual(['2026-11-09', '2026-11-09']);
    // The next local day becomes due again.
    await run(fetcher, { now: new Date('2026-11-10T00:00:00Z') });
    expect(deliveries).toHaveLength(4);
  });

  it('only one of two racing claims wins at the database layer', async () => {
    await seed('a');
    const row = await raw.pushSubscription.findFirstOrThrow();
    const update = () =>
      raw.$queryRawUnsafe<{ id: string }[]>(
        `UPDATE "PushSubscription" SET "lastSentDate"=? WHERE id=? AND ("lastSentDate" IS NULL OR "lastSentDate"<>?) RETURNING id`,
        '2026-11-09',
        row.id,
        '2026-11-09',
      );
    expect([(await update()).length, (await update()).length]).toEqual([1, 0]);
  });

  it('deletes rows on 404 and 410 and skips subscriptions outside their hour', async () => {
    await seed('not-found');
    await seed('expired');
    await seed('alive');
    await seed('other-hour', { hour: 20 });
    await seed('other-zone', { tz: 'America/New_York' });
    const { deliveries, fetcher } = pushService((url) =>
      url.endsWith('not-found') ? 404 : url.endsWith('expired') ? 410 : 201,
    );
    expect(await run(fetcher)).toMatchObject({ sent: 1, gone: 2, failed: 0 });
    expect(deliveries).toHaveLength(3);
    const hours = await raw.pushSubscription.findMany({ select: { hour: true, tz: true } });
    expect(hours).toHaveLength(3);
    expect(await raw.pushSubscription.count({ where: { lastSentDate: '2026-11-09' } })).toBe(1);
  });

  it('counts failures, resets on success and disables after repeated failures', async () => {
    await seed('flaky');
    let status = 500;
    const { fetcher } = pushService(() => status);
    let day = 9;
    const nextDay = () => {
      const date = new Date(Date.UTC(2026, 10, day, 0, 0, 0));
      day += 1;
      return date;
    };
    await run(fetcher, { now: nextDay() });
    expect((await raw.pushSubscription.findFirstOrThrow()).failureCount).toBe(1);
    status = 201;
    await run(fetcher, { now: nextDay() });
    expect((await raw.pushSubscription.findFirstOrThrow()).failureCount).toBe(0);
    status = 503;
    for (let index = 0; index < MAX_PUSH_FAILURES; index += 1)
      await run(fetcher, { now: nextDay() });
    const row = await raw.pushSubscription.findFirstOrThrow();
    expect(row.failureCount).toBe(MAX_PUSH_FAILURES);
    expect(row.disabledAt).toBeInstanceOf(Date);
    const before = vi.mocked(fetcher).mock.calls.length;
    await run(fetcher, { now: nextDay() });
    expect(vi.mocked(fetcher).mock.calls).toHaveLength(before);
  });

  it('does not let one unreadable row abort the batch', async () => {
    await seed('broken');
    await seed('fine');
    const rows = await raw.pushSubscription.findMany({ orderBy: { id: 'asc' } });
    await raw.pushSubscription.update({
      where: { id: rows[0]!.id },
      data: { encEndpoint: 'tampered' },
    });
    const { deliveries, fetcher } = pushService();
    expect(await run(fetcher)).toMatchObject({ sent: 1, failed: 1 });
    expect(deliveries).toHaveLength(1);
  });

  it('honours the per-run ceiling and leaves overflow for later runs in the catch-up window', async () => {
    for (const name of ['a', 'b', 'c', 'd', 'e']) await seed(name);
    const { deliveries, fetcher } = pushService();
    const first = await run(fetcher, { maxPerRun: 2, batchSize: 2 });
    expect(first).toMatchObject({ claimed: 2, truncated: true });
    expect(await raw.pushSubscription.count({ where: { lastSentDate: null } })).toBe(3);
    await run(fetcher, { maxPerRun: 2, batchSize: 2, now: new Date('2026-11-09T01:00:00Z') });
    await run(fetcher, { maxPerRun: 2, batchSize: 2, now: new Date('2026-11-09T02:00:00Z') });
    expect(deliveries).toHaveLength(5);
    // Past the catch-up window a reminder is dropped rather than arriving hours late.
    await seed('late');
    await run(fetcher, { now: new Date('2026-11-09T03:00:00Z') });
    expect(deliveries).toHaveLength(5);
  });

  it('stops starting batches when the run deadline has passed', async () => {
    await seed('a');
    const { deliveries, fetcher } = pushService();
    expect(await run(fetcher, { maxRunMs: -1 })).toMatchObject({ claimed: 0, truncated: true });
    expect(deliveries).toEqual([]);
  });
});

describe('cron route and feature switch', () => {
  const realFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = realFetch;
  });
  const stubNetwork = () => {
    const { deliveries, fetcher } = pushService();
    globalThis.fetch = fetcher;
    return deliveries;
  };

  it('requires the cron secret', async () => {
    const deliveries = stubNetwork();
    expect((await cron('wrong')).status).toBe(401);
    expect(deliveries).toEqual([]);
  });

  it('sends on the authenticated run with the catalog wording and releases its lock', async () => {
    const deliveries = stubNetwork();
    vi.useFakeTimers({ now: eightAm, toFake: ['Date'] });
    await seed('a');
    const response = await cron();
    expect(await response.json()).toMatchObject({
      ok: true,
      data: { result: 'done', sent: 1 },
    });
    expect(deliveries).toHaveLength(1);
    const plain = new TextDecoder().decode(
      await decryptPushPayload(deliveries[0]!.body, device.receiver, device.auth),
    );
    expect(JSON.parse(plain)).toMatchObject({
      title: 'en:push.reminder.title',
      body: 'en:push.reminder.body',
    });
    expect(await raw.ephemeralState.count()).toBe(0);
  });

  it.each([
    ['FEATURE_WEB_PUSH', 'false'],
    ['NEXT_PUBLIC_FEATURE_WEB_PUSH', 'false'],
  ])('sends nothing and rejects subscribing while %s is off', async (name, value) => {
    const deliveries = stubNetwork();
    vi.useFakeTimers({ now: eightAm, toFake: ['Date'] });
    await seed('a');
    vi.stubEnv(name, value);
    expect(await (await cron()).json()).toEqual({ ok: true, data: { result: 'disabled' } });
    expect(deliveries).toEqual([]);
    const disabled = { ok: false, error: { code: 'E_FEATURE_DISABLED' } };
    expect(await subscribePushAction(subscription('new'))).toEqual(disabled);
    expect(await unsubscribePushAction(endpoint('a'))).toEqual(disabled);
    expect(await pushStatusAction(endpoint('a'))).toEqual(disabled);
    expect(await raw.pushSubscription.count()).toBe(1);
    expect(await raw.pushSubscription.count({ where: { lastSentDate: { not: null } } })).toBe(0);
  });

  it('sends nothing while the cost circuit is open', async () => {
    const deliveries = stubNetwork();
    vi.useFakeTimers({ now: eightAm, toFake: ['Date'] });
    await seed('a');
    state.circuit.set('circuit', 'open');
    expect(await (await cron()).json()).toEqual({ ok: true, data: { result: 'circuit_open' } });
    expect(deliveries).toEqual([]);
    state.circuit.set('circuit:mode', 'closed');
    expect(await (await cron()).json()).toMatchObject({ data: { result: 'done', sent: 1 } });
  });

  it('skips without VAPID configuration and while another run holds the lock', async () => {
    const deliveries = stubNetwork();
    vi.useFakeTimers({ now: eightAm, toFake: ['Date'] });
    await seed('a');
    vi.stubEnv('VAPID_PRIVATE_KEY', '');
    expect(await (await cron()).json()).toEqual({ ok: true, data: { result: 'unconfigured' } });
    vi.stubEnv('VAPID_PRIVATE_KEY', vapid.keys.privateKey);
    await raw.ephemeralState.create({
      data: { key: 'web-push:cron-lock', value: 'x', expiresAt: Date.now() + 60000 },
    });
    expect(await (await cron()).json()).toEqual({ ok: true, data: { result: 'busy' } });
    expect(deliveries).toEqual([]);
  });

  it('actions require a signed-in owner, are rate limited and validate input', async () => {
    state.auth.mockResolvedValueOnce(null);
    expect(await subscribePushAction(subscription('a'))).toEqual({
      ok: false,
      error: { code: 'E_UNAUTHORIZED' },
    });
    state.limited = true;
    expect(await subscribePushAction(subscription('a'))).toEqual({
      ok: false,
      error: { code: 'E_RATE_LIMITED' },
    });
    state.limited = false;
    expect(await subscribePushAction(subscription('a', { hour: 3 }))).toEqual({
      ok: false,
      error: { code: 'E_VALIDATION' },
    });
    expect(await subscribePushAction(subscription('a'))).toMatchObject({ ok: true });
    expect(await pushStatusAction(endpoint('a'))).toEqual({
      ok: true,
      data: { subscribed: true, hour: 8 },
    });
    expect(await unsubscribePushAction(endpoint('a'))).toMatchObject({ ok: true });
    expect(await raw.pushSubscription.count()).toBe(0);
  });
});
