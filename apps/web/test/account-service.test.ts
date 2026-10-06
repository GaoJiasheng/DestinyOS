import { beforeEach, afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import { isolatedSqlite } from '../../../scripts/sqlite-test';
import { encryptField } from '../lib/crypto';
const state = vi.hoisted(() => ({ db: null as unknown }));
vi.mock('../lib/db', () => ({ getDb: () => state.db }));
import { cronAuthorized, hardDeleteAccounts, softDeleteAccount } from '../lib/account-service';
const database = isolatedSqlite(),
  db = database.client;
state.db = db;
beforeEach(async () => {
  vi.clearAllMocks();
  vi.stubEnv('PLATFORM', 'vercel');
  vi.stubEnv('CRON_SECRET', 'test-secret');
  vi.stubEnv('FIELD_ENCRYPTION_KEYS', `v1:${Buffer.alloc(32, 1).toString('base64')}`);
  await db.feedback.deleteMany();
  await db.user.deleteMany();
  await db.adminAuditLog.deleteMany();
  await db.user.create({ data: { id: 'owner', email: 'owner@example.test' } });
});
afterEach(() => vi.unstubAllGlobals());
afterAll(async () => {
  await db.$disconnect();
  await database.close();
  vi.unstubAllEnvs();
});
async function privateRecords() {
  const profile = await db.birthProfile.create({
    data: {
      userId: 'owner',
      encBirth: 'v1:fixture',
      gender: 'male',
      timeUnknown: false,
      tz: 'Asia/Shanghai',
      birthYear: 1990,
      chartHash: 'fixture',
    },
  });
  const reading = await db.reading.create({
    data: {
      userId: 'owner',
      profileId: profile.id,
      system: 'bazi',
      encInput: 'v1:fixture',
      chart: {},
      schoolUsed: {},
      engineVersion: '1',
      interpretVersion: '1',
      knowledgeVersion: '1',
      isPublic: true,
    },
  });
  await db.session.create({
    data: { userId: 'owner', sessionToken: 'owner-session', expires: new Date(Date.now() + 60000) },
  });
  await db.journalEntry.create({
    data: {
      userId: 'owner',
      profileId: profile.id,
      date: new Date('2026-10-06T00:00:00Z'),
      mood: 3,
      text: encryptField('Private note', 'JournalEntry.text', 'owner'),
      prediction: {},
    },
  });
  await db.shareLink.create({
    data: { userId: 'owner', readingId: reading.id, token: 'A'.repeat(22), template: 'default' },
  });
  await db.feedback.create({
    data: {
      userId: 'owner',
      readingId: reading.id,
      vote: 1,
      text: 'Retain anonymous feedback',
    },
  });
  return reading;
}
describe('account lifecycle on the D1 SQLite schema', () => {
  it('atomically revokes sessions/shares, deletes journals and anonymizes feedback', async () => {
    const reading = await privateRecords();
    await softDeleteAccount('owner');
    expect(await db.session.count()).toBe(0);
    expect(await db.journalEntry.count()).toBe(0);
    expect((await db.shareLink.findFirstOrThrow()).revokedAt).toBeInstanceOf(Date);
    expect((await db.reading.findUniqueOrThrow({ where: { id: reading.id } })).isPublic).toBe(
      false,
    );
    expect(await db.feedback.findFirstOrThrow()).toMatchObject({
      userId: null,
      readingId: null,
      text: 'Retain anonymous feedback',
    });
    expect((await db.user.findUniqueOrThrow({ where: { id: 'owner' } })).deletedAt).toBeInstanceOf(
      Date,
    );
    expect(await db.adminAuditLog.count()).toBe(1);
  });
  it('supports explicit removal of the owner feedback', async () => {
    await privateRecords();
    await softDeleteAccount('owner', true);
    expect(await db.feedback.count()).toBe(0);
  });
  it('preserves access if Stripe cancellation fails and cancels immediately on success', async () => {
    vi.stubEnv('STRIPE_SECRET_KEY', 'sk_test');
    await db.subscription.create({
      data: {
        userId: 'owner',
        stripeSubscriptionId: 'sub_test',
        stripeCustomerId: 'cus_test',
        status: 'active',
      },
    });
    const fetch = vi.fn().mockResolvedValue(new Response('', { status: 500 }));
    vi.stubGlobal('fetch', fetch);
    await expect(softDeleteAccount('owner')).rejects.toMatchObject({ code: 'E_PAYMENT' });
    expect((await db.user.findUniqueOrThrow({ where: { id: 'owner' } })).deletedAt).toBeNull();
    expect(await db.adminAuditLog.count()).toBe(0);
    fetch.mockResolvedValue(new Response('{}', { status: 200 }));
    await softDeleteAccount('owner');
    expect(fetch).toHaveBeenLastCalledWith(
      'https://api.stripe.com/v1/subscriptions/sub_test',
      expect.objectContaining({ method: 'DELETE' }),
    );
    expect(await db.subscription.findUniqueOrThrow({ where: { userId: 'owner' } })).toMatchObject({
      status: 'canceled',
      cancelAtPeriodEnd: false,
    });
  });
  it('authenticates cron, enforces the seven-day cutoff and deletes tokens with anonymous audit', async () => {
    expect(cronAuthorized(null)).toBe(false);
    expect(cronAuthorized('Bearer wrong')).toBe(false);
    expect(cronAuthorized('Bearer test-secret')).toBe(true);
    await db.user.create({
      data: { id: 'due', email: 'due@example.test', deletedAt: new Date('2026-09-28T03:00:00Z') },
    });
    await db.user.create({ data: { id: 'not-due', deletedAt: new Date('2026-09-28T03:00:01Z') } });
    await db.verificationToken.create({
      data: { identifier: 'due@example.test', token: 'due-token', expires: new Date('2026-10-06') },
    });
    expect(await hardDeleteAccounts(new Date('2026-10-05T03:00:00Z'))).toBe(1);
    expect(await db.user.findUnique({ where: { id: 'due' } })).toBeNull();
    expect(await db.user.findUnique({ where: { id: 'not-due' } })).not.toBeNull();
    expect(await db.verificationToken.count()).toBe(0);
    expect(await db.adminAuditLog.findFirstOrThrow()).toMatchObject({
      adminId: 'system:cron',
      action: 'user.hard_delete',
      target: null,
    });
  });
});
