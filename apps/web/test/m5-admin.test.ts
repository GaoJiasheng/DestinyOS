import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { eventIdentity } from '../lib/events';
import { recentAuthentication, requireAdmin } from '../lib/admin-auth';
const guard = vi.hoisted(() => ({
  auth: vi.fn(),
  session: vi.fn(),
  cookie: vi.fn(),
  signIn: vi.fn(),
  revoke: vi.fn(),
  audit: vi.fn(),
}));
import { reauthGoogleAction } from '../app/admin/actions';
import { SiteConfigSchema } from '../lib/site-config-schema';
vi.mock('../lib/auth', () => ({ auth: guard.auth, signIn: guard.signIn }));
vi.mock('../lib/db', () => ({
  getDb: () => ({
    session: { findUnique: guard.session },
    $transaction: async (
      work: (tx: {
        session: { deleteMany: typeof guard.revoke };
        adminAuditLog: { create: typeof guard.audit };
      }) => Promise<unknown>,
    ) => work({ session: { deleteMany: guard.revoke }, adminAuditLog: { create: guard.audit } }),
  }),
}));
vi.mock('next/headers', () => ({ cookies: async () => ({ get: guard.cookie }) }));
vi.mock('next/navigation', () => ({
  notFound: () => {
    throw new Error('404');
  },
  redirect: () => {
    throw new Error('reauth');
  },
}));
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('AUTH_SECRET', 'unit-event-pseudonym-secret');
  vi.stubEnv('ADMIN_EMAILS', 'admin@example.test');
});
afterEach(() => vi.unstubAllEnvs());
describe('M5 security contracts', () => {
  it('rotates only the requesting admin OAuth session, audits without its credential, and rejects unauthorized rotation', async () => {
    guard.auth.mockResolvedValue({
      user: { id: 'admin', email: 'admin@example.test', role: 'admin' },
    });
    guard.cookie.mockReturnValue({ value: 'private-session-token' });
    guard.session.mockResolvedValue({
      userId: 'admin',
      expires: new Date(Date.now() + 60000),
      authenticatedAt: new Date(0),
    });
    await reauthGoogleAction();
    expect(guard.revoke).toHaveBeenCalledWith({
      where: { sessionToken: 'private-session-token', userId: 'admin' },
    });
    expect(guard.audit).toHaveBeenCalledOnce();
    expect(JSON.stringify(guard.audit.mock.calls)).not.toContain('private-session-token');
    expect(guard.signIn).toHaveBeenCalledWith(
      'google',
      { redirectTo: '/admin' },
      { prompt: 'select_account', max_age: '0' },
    );
    expect(guard.revoke.mock.invocationCallOrder[0]).toBeLessThan(
      guard.signIn.mock.invocationCallOrder[0]!,
    );
    vi.clearAllMocks();
    guard.auth.mockResolvedValue(null);
    await expect(reauthGoogleAction()).rejects.toThrow('404');
    expect(guard.revoke).not.toHaveBeenCalled();
    expect(guard.signIn).not.toHaveBeenCalled();
  });
  it('requires allowlisted admin role and a matching unexpired session on every action; stale admin sessions redirect', async () => {
    guard.auth.mockResolvedValue(null);
    await expect(requireAdmin()).rejects.toThrow('404');
    guard.auth.mockResolvedValue({
      user: { id: 'admin', email: 'outsider@example.test', role: 'admin' },
    });
    await expect(requireAdmin()).rejects.toThrow('404');
    const user = { id: 'admin', email: 'admin@example.test', role: 'admin' };
    guard.auth.mockResolvedValue({ user });
    guard.cookie.mockReturnValue({ value: 'session-token' });
    guard.session.mockResolvedValue({
      userId: 'someone-else',
      expires: new Date(Date.now() + 60000),
      authenticatedAt: new Date(),
    });
    await expect(requireAdmin()).rejects.toThrow('404');
    guard.session.mockResolvedValue({
      userId: 'admin',
      expires: new Date(Date.now() - 1),
      authenticatedAt: new Date(),
    });
    await expect(requireAdmin()).rejects.toThrow('404');
    guard.session.mockResolvedValue({
      userId: 'admin',
      expires: new Date(Date.now() + 60000),
      authenticatedAt: new Date(Date.now() - 600001),
    });
    await expect(requireAdmin()).rejects.toThrow('reauth');
    expect(await requireAdmin(false)).toEqual(user);
    guard.session.mockResolvedValue({
      userId: 'admin',
      expires: new Date(Date.now() + 60000),
      authenticatedAt: new Date(),
    });
    expect(await requireAdmin()).toEqual(user);
  });
  it('accepts fresh provider sessions but rejects the ten-minute boundary, old sessions and future dates', () => {
    const now = Date.parse('2026-10-04T12:00:00Z');
    expect(recentAuthentication(new Date(now), now)).toBe(true);
    expect(recentAuthentication(new Date(now - 599999), now)).toBe(true);
    expect(recentAuthentication(new Date(now - 600000), now)).toBe(false);
    expect(recentAuthentication(new Date(now + 1), now)).toBe(false);
    expect(recentAuthentication(new Date(0), now)).toBe(false);
  });
  it('deduplicates activity within a UTC day and rotates pseudonyms across days without retaining identity', () => {
    const first = eventIdentity('private-owner', new Date('2026-10-04T00:01:00Z'));
    const later = eventIdentity('private-owner', new Date('2026-10-04T23:59:59Z'));
    const next = eventIdentity('private-owner', new Date('2026-10-05T00:00:00Z'));
    expect(first.userHash).toBe(later.userHash);
    expect(first.userHash).not.toBe(next.userHash);
    expect(first.userHash).not.toBe(eventIdentity('different-owner', first.day).userHash);
    expect(JSON.stringify(first)).not.toContain('private-owner');
    expect(eventIdentity(undefined, first.day)).not.toHaveProperty('userHash');
  });
  it('rejects external announcement scopes, inverted schedules, unknown config keys and nonboolean switches', () => {
    const value = {
      announcement: {
        zh: '公告',
        en: 'Announcement',
        scope: ['/today'],
        startsAt: null,
        endsAt: null,
      },
      'ads.enabled': true,
      'feature.llmPolish': false,
      'feature.panchangDefaultOpen': false,
      maintenance: false,
    };
    expect(SiteConfigSchema.safeParse(value).success).toBe(true);
    expect(SiteConfigSchema.safeParse({ ...value, 'ads.enabled': 'true' }).success).toBe(false);
    expect(SiteConfigSchema.safeParse({ ...value, secret: 'unknown' }).success).toBe(false);
    expect(
      SiteConfigSchema.safeParse({
        ...value,
        announcement: { ...value.announcement, scope: ['https://external.test'] },
      }).success,
    ).toBe(false);
    expect(
      SiteConfigSchema.safeParse({
        ...value,
        announcement: {
          ...value.announcement,
          startsAt: '2026-10-05T00:00:00Z',
          endsAt: '2026-10-04T00:00:00Z',
        },
      }).success,
    ).toBe(false);
  });
});
