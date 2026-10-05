import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocked = vi.hoisted(() => ({
  subscription: vi.fn(),
  userUpdate: vi.fn(),
  sessions: vi.fn(),
  journals: vi.fn(),
  shares: vi.fn(),
  readings: vi.fn(),
  feedbackDelete: vi.fn(),
  feedbackUpdate: vi.fn(),
  subUpdate: vi.fn(),
  due: vi.fn(),
  userDelete: vi.fn(),
  audit: vi.fn(),
}));
vi.mock('../lib/db', () => {
  const db = {
    subscription: { findUnique: mocked.subscription, update: mocked.subUpdate },
    user: { update: mocked.userUpdate, findMany: mocked.due, delete: mocked.userDelete },
    session: { deleteMany: mocked.sessions },
    journalEntry: { deleteMany: mocked.journals },
    shareLink: { updateMany: mocked.shares },
    reading: { updateMany: mocked.readings },
    feedback: { deleteMany: mocked.feedbackDelete, updateMany: mocked.feedbackUpdate },
    adminAuditLog: { create: mocked.audit },
  };
  return {
    getDb: () => ({
      ...db,
      $transaction: async (work: (tx: typeof db) => Promise<unknown>) => work(db),
    }),
  };
});
import { cronAuthorized, hardDeleteAccounts, softDeleteAccount } from '../lib/account-service';
beforeEach(() => {
  vi.clearAllMocks();
  mocked.subscription.mockResolvedValue(null);
  vi.stubEnv('CRON_SECRET', 'test-secret');
});
describe('account lifecycle', () => {
  it('revokes sessions/shares and anonymizes feedback in the deletion transaction', async () => {
    await softDeleteAccount('owner');
    expect(mocked.sessions).toHaveBeenCalledWith({ where: { userId: 'owner' } });
    expect(mocked.journals).toHaveBeenCalledWith({ where: { userId: 'owner' } });
    expect(mocked.shares).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: 'owner', revokedAt: null } }),
    );
    expect(mocked.feedbackUpdate).toHaveBeenCalledWith({
      where: { userId: 'owner' },
      data: { userId: null, readingId: null },
    });
    expect(mocked.feedbackDelete).not.toHaveBeenCalled();
  });
  it('supports explicit removal of the owner feedback', async () => {
    await softDeleteAccount('owner', true);
    expect(mocked.feedbackDelete).toHaveBeenCalledWith({ where: { userId: 'owner' } });
    expect(mocked.feedbackUpdate).not.toHaveBeenCalled();
  });
  it('does not lock out the owner when Stripe cancellation fails; cancels immediately on success', async () => {
    vi.stubEnv('STRIPE_SECRET_KEY', 'sk_test');
    mocked.subscription.mockResolvedValue({ stripeSubscriptionId: 'sub_test', status: 'active' });
    const fetch = vi.fn().mockResolvedValue(new Response('', { status: 500 }));
    vi.stubGlobal('fetch', fetch);
    await expect(softDeleteAccount('owner')).rejects.toMatchObject({ code: 'E_PAYMENT' });
    expect(mocked.userUpdate).not.toHaveBeenCalled();
    fetch.mockResolvedValue(new Response('{}', { status: 200 }));
    await softDeleteAccount('owner');
    expect(fetch).toHaveBeenLastCalledWith(
      'https://api.stripe.com/v1/subscriptions/sub_test',
      expect.objectContaining({ method: 'DELETE' }),
    );
    expect(mocked.subUpdate).toHaveBeenCalledWith({
      where: { userId: 'owner' },
      data: { status: 'canceled', cancelAtPeriodEnd: false },
    });
    vi.unstubAllGlobals();
  });
  it('authenticates cron and limits deletion to the seven-day cutoff with anonymous audit entries', async () => {
    expect(cronAuthorized(null)).toBe(false);
    expect(cronAuthorized('Bearer wrong')).toBe(false);
    expect(cronAuthorized('Bearer test-secret')).toBe(true);
    mocked.due.mockResolvedValue([{ id: 'due' }]);
    expect(await hardDeleteAccounts(new Date('2026-10-05T03:00:00Z'))).toBe(1);
    expect(mocked.due).toHaveBeenCalledWith({
      where: { deletedAt: { lte: new Date('2026-09-28T03:00:00Z') } },
      select: { id: true, email: true },
    });
    expect(mocked.audit).toHaveBeenCalledWith({
      data: { adminId: 'system:cron', action: 'user.hard_delete' },
    });
  });
});
