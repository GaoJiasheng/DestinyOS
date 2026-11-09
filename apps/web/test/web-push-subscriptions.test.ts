import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { isolatedSqlite } from '../../../scripts/sqlite-test';
import { rotateKeys } from '../../../scripts/rotate-keys';
import { fieldEncryptionExtension } from '../lib/db-encryption';
import { decryptField } from '../lib/crypto';
import {
  FIELD_KEY as KEY,
  endpoint,
  pushService,
  stubPushEnvironment,
  subscriptionInput,
  type PushDevice,
  type PushVapid,
  copy,
} from './web-push-fixture';

const state = vi.hoisted(() => ({ db: undefined as unknown }));
vi.mock('../lib/db', () => ({ getDb: () => state.db }));

import { exportAccount, softDeleteAccount } from '../lib/account-service';
import {
  pushSubscriptionStatus,
  savePushSubscription,
  deletePushSubscription,
  sendDueReminders,
} from '../lib/web-push-service';

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
  sendDueReminders({ vapid, copy, fetch: fetcher, ...extra });

beforeEach(async () => {
  ({ vapid, device } = await stubPushEnvironment());
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

describe('subscriptions', () => {
  it('stores the endpoint and keys only as ciphertext, bound to the owner', async () => {
    await savePushSubscription('owner', subscription('a'));
    const [row] = (await database.query('SELECT * FROM "PushSubscription"')) as unknown[];
    const stored = row as { encEndpoint: string; encKeys: string; endpointHash: string };
    expect(JSON.stringify(row)).not.toContain('push.example.test');
    expect(JSON.stringify(row)).not.toContain(device.p256dh);
    expect(stored.endpointHash).toMatch(/^[0-9a-f]{64}$/);
    expect(decryptField(stored.encEndpoint, 'PushSubscription.encEndpoint', 'owner')).toBe(
      endpoint('a'),
    );
    expect(
      JSON.parse(decryptField(stored.encKeys, 'PushSubscription.encKeys', 'owner')),
    ).toMatchObject({ p256dh: device.p256dh, auth: device.auth });
    expect(() =>
      decryptField(stored.encEndpoint, 'PushSubscription.encEndpoint', 'other'),
    ).toThrow();
  });

  it('allows several devices, upserts one device and caps the list per account', async () => {
    await savePushSubscription('owner', subscription('a', { hour: 7 }));
    await savePushSubscription('owner', subscription('b'));
    await savePushSubscription('owner', subscription('a', { hour: 20, locale: 'zh' }));
    const rows = await raw.pushSubscription.findMany({ orderBy: { hour: 'asc' } });
    expect(rows.map((row) => [row.hour, row.locale])).toEqual([
      [8, 'en'],
      [20, 'zh'],
    ]);
    for (let index = 0; index < 12; index += 1)
      await savePushSubscription('owner', subscription(`device-${index}`));
    expect(await raw.pushSubscription.count({ where: { userId: 'owner' } })).toBe(10);
  });

  it('moves a shared browser to the new account under that account key', async () => {
    await savePushSubscription('owner', subscription('shared'));
    await savePushSubscription('other', subscription('shared'));
    const [row] = await raw.pushSubscription.findMany();
    expect(row?.userId).toBe('other');
    expect(decryptField(row!.encEndpoint, 'PushSubscription.encEndpoint', 'other')).toBe(
      endpoint('shared'),
    );
    expect(await raw.pushSubscription.count()).toBe(1);
  });

  it('rejects unsafe endpoints, malformed keys, unsupported hours and zones', async () => {
    for (const bad of [
      { endpoint: 'http://push.example.test/a' },
      { endpoint: 'https://localhost/a' },
      { endpoint: 'https://169.254.169.254/latest' },
      { p256dh: 'short' },
      { auth: 'short' },
      { hour: 3 },
      { hour: 8.5 },
      { tz: 'Mars/Base' },
      { locale: 'fr' },
      { extra: true },
    ])
      await expect(savePushSubscription('owner', subscription('x', bad))).rejects.toThrow();
    expect(await raw.pushSubscription.count()).toBe(0);
  });

  it('starts tomorrow when the chosen hour already passed, without a catch-up send', async () => {
    vi.useFakeTimers({ now: new Date('2026-11-09T01:30:00Z'), toFake: ['Date'] });
    await savePushSubscription('owner', subscription('late'));
    expect((await raw.pushSubscription.findFirstOrThrow()).lastSentDate).toBe('2026-11-09');
    await savePushSubscription('owner', subscription('early', { hour: 12 }));
    expect(
      (await raw.pushSubscription.findFirstOrThrow({ where: { hour: 12 } })).lastSentDate,
    ).toBeNull();
    vi.useRealTimers();
    const { deliveries, fetcher } = pushService();
    await run(fetcher, { now: new Date('2026-11-09T02:00:00Z') });
    expect(deliveries).toEqual([]);
  });

  it('moving a sent reminder to a later hour cannot send it twice that day', async () => {
    await seed('a');
    await raw.pushSubscription.updateMany({ data: { lastSentDate: '2026-11-09' } });
    vi.useFakeTimers({ now: new Date('2026-11-09T02:30:00Z'), toFake: ['Date'] });
    await savePushSubscription('owner', subscription('a', { hour: 20 }));
    const row = await raw.pushSubscription.findFirstOrThrow();
    expect([row.hour, row.lastSentDate]).toEqual([20, '2026-11-09']);
  });

  it('reports status per owner and deletes only the caller device', async () => {
    await savePushSubscription('owner', subscription('a', { hour: 9 }));
    expect(await pushSubscriptionStatus('owner', endpoint('a'))).toEqual({
      subscribed: true,
      hour: 9,
    });
    expect(await pushSubscriptionStatus('other', endpoint('a'))).toEqual({
      subscribed: false,
      hour: null,
    });
    await deletePushSubscription('other', endpoint('a'));
    expect(await raw.pushSubscription.count()).toBe(1);
    await deletePushSubscription('owner', endpoint('a'));
    expect(await raw.pushSubscription.count()).toBe(0);
  });
});

describe('account lifecycle', () => {
  it('removes subscriptions when the account is deleted', async () => {
    await savePushSubscription('owner', subscription('a'));
    await savePushSubscription('other', subscription('b'));
    await softDeleteAccount('owner');
    expect(await raw.pushSubscription.findMany({ select: { userId: true } })).toEqual([
      { userId: 'other' },
    ]);
    await raw.user.delete({ where: { id: 'other' } });
    expect(await raw.pushSubscription.count()).toBe(0);
  });

  it('exports reminder preferences without endpoints or keys', async () => {
    await savePushSubscription('owner', subscription('a', { hour: 9 }));
    const exported = await exportAccount('owner');
    expect(exported.pushSubscriptions).toEqual([
      expect.objectContaining({ locale: 'en', tz: 'Asia/Shanghai', hour: 9 }),
    ]);
    const text = JSON.stringify(exported);
    for (const secret of [
      'push.example.test',
      device.p256dh,
      device.auth,
      'encEndpoint',
      'encKeys',
    ])
      expect(text).not.toContain(secret);
  });

  it('rotates subscription ciphertext to the current key', async () => {
    await savePushSubscription('owner', subscription('a'));
    const before = await raw.pushSubscription.findFirstOrThrow();
    const current = `v2:${Buffer.alloc(32, 2).toString('base64')}`;
    vi.stubEnv('FIELD_ENCRYPTION_KEYS', `${current},${KEY}`);
    await rotateKeys(raw);
    const after = await raw.pushSubscription.findFirstOrThrow();
    expect(after.encEndpoint.startsWith('v2:')).toBe(true);
    expect(after.encEndpoint).not.toBe(before.encEndpoint);
    expect(decryptField(after.encEndpoint, 'PushSubscription.encEndpoint', 'owner')).toBe(
      endpoint('a'),
    );
  });
});
