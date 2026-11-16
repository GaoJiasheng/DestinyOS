import { beforeEach, expect, it, vi } from 'vitest';
const m = vi.hoisted(() => ({
  links: vi.fn(),
  batch: vi.fn(),
  reserve: vi.fn(async () => true),
  release: vi.fn(async () => true),
}));
vi.mock('../lib/state', () => ({ stateReserve: m.reserve, stateRelease: m.release }));
vi.mock('../lib/ratelimit', () => ({
  ratelimit: vi.fn(async () => ({ success: true })),
  assertRateLimit: vi.fn(),
}));
vi.mock('../lib/events', () => ({ recordEvent: vi.fn() }));
vi.mock('../lib/db-batch', () => ({
  atomicBatch: m.batch,
  guard: () => [],
  insertRow: () => ({}),
  updateRows: () => ({}),
}));
vi.mock('../lib/db', () => ({
  getDb: () => ({
    reading: { findFirst: async () => ({ id: 'r1', system: 'bazi' }) },
    user: { findFirst: async () => ({ id: 'u1', plan: 'free' }) },
    birthProfile: { findFirst: async () => ({ id: 'p1' }) },
    shareLink: { findMany: m.links },
  }),
}));
const { createShareForUser } = await import('../lib/share-service');
const day = 86400000;
beforeEach(() => vi.clearAllMocks());
it('reuses a live link with the same template, visibility and expiry instead of creating one', async () => {
  const created = new Date(Date.now() - day);
  m.links.mockResolvedValue([
    {
      token: 'A'.repeat(22),
      template: 'chart',
      revealLevel: 0,
      createdAt: created,
      expiresAt: null,
    },
    {
      token: 'B'.repeat(22),
      template: 'chart',
      revealLevel: 0,
      createdAt: created,
      expiresAt: new Date(created.getTime() + 7 * day),
    },
  ]);
  const never = await createShareForUser('u1', { readingId: 'r1', template: 'chart' }, 'zh');
  expect(never).toMatchObject({ token: 'A'.repeat(22), reused: true, expiresAt: null });
  const week = await createShareForUser(
    'u1',
    { readingId: 'r1', template: 'chart', expiresIn: 7 },
    'zh',
  );
  expect(week).toMatchObject({ token: 'B'.repeat(22), reused: true });
  expect(m.batch).not.toHaveBeenCalled();
  const month = await createShareForUser(
    'u1',
    { readingId: 'r1', template: 'chart', expiresIn: 30 },
    'zh',
  );
  expect(month.reused).toBe(false);
  expect(month.expiresAt).not.toBeNull();
  expect(m.batch).toHaveBeenCalledTimes(1);
});
const dailyLink = (token: string, createdAt: Date) => ({
  token: token.repeat(22),
  template: 'daily',
  revealLevel: 0,
  createdAt,
  expiresAt: null,
});
it('reuses a live daily card link from the same local day and creates one when none qualifies', async () => {
  m.links.mockResolvedValue([dailyLink('A', new Date(Date.now() - 1000))]);
  const again = await createShareForUser('u1', { readingId: 'r1', template: 'daily' }, 'zh');
  expect(again).toMatchObject({ token: 'A'.repeat(22), reused: true });
  expect(m.batch).not.toHaveBeenCalled();
  // Yesterday's card renders yesterday's content, and a revoked link is simply absent from the live list.
  m.links.mockResolvedValue([dailyLink('B', new Date(Date.now() - 2 * day))]);
  const fresh = await createShareForUser('u1', { readingId: 'r1', template: 'daily' }, 'zh');
  expect(fresh.reused).toBe(false);
  m.links.mockResolvedValue([]);
  expect(
    (await createShareForUser('u1', { readingId: 'r1', template: 'daily' }, 'zh')).reused,
  ).toBe(false);
  expect(m.batch).toHaveBeenCalledTimes(2);
});
it('a concurrent daily tap waits for the lease holder and reuses its link instead of creating a second', async () => {
  m.reserve.mockResolvedValueOnce(false);
  m.links
    .mockResolvedValueOnce([])
    .mockResolvedValueOnce([dailyLink('C', new Date(Date.now() - 1000))]);
  const result = await createShareForUser('u1', { readingId: 'r1', template: 'daily' }, 'zh');
  expect(result).toMatchObject({ token: 'C'.repeat(22), reused: true });
  expect(m.batch).not.toHaveBeenCalled();
  m.reserve.mockResolvedValueOnce(false);
  m.links.mockResolvedValue([]);
  await expect(
    createShareForUser('u1', { readingId: 'r1', template: 'daily' }, 'zh'),
  ).rejects.toMatchObject({ code: 'E_CONFLICT' });
  expect(m.batch).not.toHaveBeenCalled();
});
it('releases the daily lease after creating', async () => {
  m.links.mockResolvedValue([]);
  await createShareForUser('u1', { readingId: 'r1', template: 'daily' }, 'zh');
  expect(m.reserve).toHaveBeenCalledTimes(1);
  expect(m.release).toHaveBeenCalledTimes(1);
});
