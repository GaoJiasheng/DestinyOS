import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const mock = vi.hoisted(() => ({
  auth: vi.fn(),
  reading: vi.fn(),
  link: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  aggregate: vi.fn(),
  cleanup: vi.fn(),
}));
vi.mock('../lib/auth', () => ({ auth: mock.auth }));
vi.mock('../lib/db', () => {
  const db = {
    reading: { findFirst: mock.reading, update: mock.update },
    shareLink: { findFirst: mock.link, create: mock.create, update: mock.update },
  };
  return {
    getDb: () => ({ ...db, $transaction: (work: (tx: typeof db) => Promise<unknown>) => work(db) }),
  };
});
vi.mock('../lib/ratelimit', () => ({
  ratelimit: async () => ({ success: true }),
  assertRateLimit: vi.fn(),
}));
vi.mock('../lib/events', () => ({ aggregateEvents: mock.aggregate }));
vi.mock('../lib/maintenance', () => ({
  scrubFeedback: mock.cleanup,
  maintainShares: mock.cleanup,
}));
import { createShareLinkAction, revokeShareLinkAction } from '../app/share/actions';
import { GET, POST } from '../app/api/v1/cron/daily-maintenance/route';

beforeEach(() => {
  vi.clearAllMocks();
  mock.auth.mockResolvedValue({ user: { id: 'intruder', plan: 'free' } });
  mock.reading.mockResolvedValue(null);
  mock.link.mockResolvedValue(null);
});
afterEach(() => vi.unstubAllEnvs());

it('cannot create or revoke another owner share and performs no writes', async () => {
  expect(await createShareLinkAction({ readingId: 'victim-reading', template: 'chart' })).toEqual({
    ok: false,
    error: { code: 'E_FORBIDDEN' },
  });
  expect(mock.reading).toHaveBeenCalledWith({
    where: { id: 'victim-reading', userId: 'intruder' },
  });
  expect(await revokeShareLinkAction('A'.repeat(22))).toEqual({
    ok: false,
    error: { code: 'E_NOT_FOUND' },
  });
  expect(mock.link).toHaveBeenCalledWith({ where: { token: 'A'.repeat(22), userId: 'intruder' } });
  expect(mock.create).not.toHaveBeenCalled();
  expect(mock.update).not.toHaveBeenCalled();
});

it('rejects both cron methods before maintenance IO with missing/wrong/unconfigured credentials', async () => {
  for (const secret of ['', 'isolated-cron-secret']) {
    vi.stubEnv('CRON_SECRET', secret);
    for (const authorization of ['', 'Bearer wrong']) {
      const request = new Request('https://example.test/api/v1/cron/daily-maintenance', {
        headers: { authorization },
      });
      expect((await POST(request)).status).toBe(401);
      expect((await GET(request)).status).toBe(401);
    }
  }
  expect(mock.aggregate).not.toHaveBeenCalled();
  expect(mock.cleanup).not.toHaveBeenCalled();
});
