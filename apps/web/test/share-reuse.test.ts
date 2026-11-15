import { beforeEach, expect, it, vi } from 'vitest';
const m = vi.hoisted(() => ({
  links: vi.fn(),
  batch: vi.fn(),
}));
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
it('always creates a new daily card link because its content is tied to the creation day', async () => {
  m.links.mockResolvedValue([]);
  const result = await createShareForUser('u1', { readingId: 'r1', template: 'daily' }, 'zh');
  expect(result.reused).toBe(false);
  expect(m.links).not.toHaveBeenCalled();
});
