import { describe, it, expect, vi, beforeEach } from 'vitest';
import RedisMock from 'ioredis-mock';
import type { Reading } from '@prisma/client';
const mocked = vi.hoisted(() => ({
  rows: new Map<string, Reading>(),
  create: vi.fn(),
  find: vi.fn(),
}));
vi.mock('../lib/db', () => ({
  getDb: () => ({
    reading: { create: mocked.create, findFirst: mocked.find, update: vi.fn() },
    birthProfile: { findUnique: vi.fn() },
  }),
}));
const redis = new RedisMock();
vi.mock('../lib/redis', () => ({ getLocalRedis: () => redis, getUpstashRedis: () => redis }));
import { generateReading, idempotentCreate, digest } from '../lib/reading-service';
import { computeDivination } from '../lib/divination';
import { parseReadingChart } from '../lib/reading-schema';
import type { ReadingRequest } from '../lib/reading-schema';
const birth = {
  calendar: 'gregorian' as const,
  year: 1990,
  month: 5,
  day: 15,
  hour: 8,
  minute: 30,
  timeUnknown: false,
  gender: 'male' as const,
  place: { name: 'Beijing', lat: 39.9, lng: 116.4, tz: 'Asia/Shanghai' },
};
const request = (): ReadingRequest => ({
  system: 'bazi',
  locale: 'zh',
  birth,
  idempotencyKey: crypto.randomUUID(),
});
beforeEach(async () => {
  vi.stubEnv('DATABASE_URL', '');
  vi.stubEnv('UPSTASH_REDIS_REST_URL', '');
  await redis.flushall();
  mocked.rows.clear();
  mocked.create.mockReset();
  mocked.find.mockReset();
  mocked.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => {
    const row = {
      ...data,
      createdAt: new Date(),
      title: null,
      isPublic: false,
      profileId: null,
      status: 'ok',
    } as unknown as Reading;
    mocked.rows.set(row.id, row);
    return row;
  });
  mocked.find.mockImplementation(async ({ where }: { where: { id: string; userId?: string } }) => {
    const row = mocked.rows.get(where.id);
    return row && row.userId === where.userId ? row : null;
  });
});
describe('reading pipeline and idempotency', () => {
  it('adapts documented flat divination inputs and retains schema-valid event clocks', async () => {
    for (const req of [
      {
        ...request(),
        system: 'iching' as const,
        birth: undefined,
        method: 'meihua',
        numbers: [8, 5],
        question: 'A bounded reflection',
        category: 'career',
      },
      {
        ...request(),
        system: 'iching' as const,
        birth: undefined,
        method: 'liuyao',
        throws: [0, 1, 2, 3, 1, 2],
      },
      {
        ...request(),
        system: 'qimen' as const,
        birth: undefined,
        question: 'A bounded reflection',
        category: 'travel',
      },
    ]) {
      const result = await generateReading(req, '2026-10-04T00:00:00Z');
      expect(() => parseReadingChart(req.system, result.chart)).not.toThrow();
      expect(result.report.system).toBe(req.system);
    }
  });

  it('persists the ritual chart with its selected civil clock instead of the later server clock', async () => {
    const at = '2026-10-04T15:30:00+08:00[Asia/Shanghai]';
    for (const req of [
      {
        system: 'iching' as const,
        locale: 'zh' as const,
        method: 'meihua',
        category: 'career',
        question: { text: 'private', meihua: { castBy: 'numbers', numbers: [3, 5, 1], at } },
        seed: 't35',
        idempotencyKey: crypto.randomUUID(),
      },
      {
        system: 'iching' as const,
        locale: 'en' as const,
        method: 'liuyao',
        category: 'wealth',
        question: { at },
        seed: 't35',
        idempotencyKey: crypto.randomUUID(),
      },
      {
        system: 'qimen' as const,
        locale: 'zh' as const,
        category: 'travel',
        question: { at },
        seed: 't35',
        idempotencyKey: crypto.randomUUID(),
      },
    ]) {
      const result = await generateReading(req, '2026-10-06T00:00:00Z');
      expect(result.chart).toEqual(computeDivination(req));
      expect(result.report.system).toBe(req.system);
    }
  });

  it('runs engine → interpretation with full chapters and no birth timestamps in chart/meta', async () => {
    const result = await generateReading(request(), '2026-10-04T00:00:00Z');
    expect(result.report.sections).toHaveLength(10);
    expect(result.report.readability.passed).toBe(true);
    expect(JSON.stringify(result.chart)).not.toContain('1990-05-15');
    expect(JSON.stringify(result.meta)).not.toContain('Beijing');
    expect(result.birthYear).toBe(1990);
  });
  it.each(['zh', 'en'] as const)(
    'Zi Wei %s: engine → full interpretation and unknown-time rejection',
    async (locale) => {
      const req = { ...request(), system: 'ziwei' as const, locale };
      const result = await generateReading(req, '2026-10-04T00:00:00Z');
      expect(() => parseReadingChart('ziwei', result.chart)).not.toThrow();
      expect(result.report.system).toBe('ziwei');
      expect(result.report.locale).toBe(locale);
      expect(result.report.sections.map((s) => s.key)).toEqual([
        'overview',
        'life_palace',
        'body_fortune',
        'career_wealth',
        'love_family',
        'health_travel',
        'patterns',
        'decadal_yearly',
        'summary_actions',
      ]);
      expect(result.report.readability.passed).toBe(true);
      expect(result.report.hits.length).toBeGreaterThan(0);
      await expect(
        generateReading(
          { ...req, birth: { ...birth, timeUnknown: true, hour: undefined, minute: undefined } },
          '2026-10-04T00:00:00Z',
        ),
      ).rejects.toMatchObject({ code: 'E_REQUIRES_BIRTH_TIME' });
      expect(mocked.create).not.toHaveBeenCalled();
    },
  );
  it('repeats anonymous requests deterministically and caches no birth input or report text', async () => {
    const req = request();
    const a = await idempotentCreate(req, 'test-ip');
    const b = await idempotentCreate(req, 'test-ip');
    expect(a).toEqual(b);
    const keys = await redis.keys('reading:idempotency:*');
    expect(keys).toHaveLength(1);
    const value = await redis.get(keys[0]!);
    expect(value).not.toContain('Beijing');
    expect(value).not.toContain('1990');
    expect(mocked.create).not.toHaveBeenCalled();
    await expect(
      idempotentCreate({ ...req, birth: { ...birth, day: 16 } }, 'test-ip'),
    ).rejects.toMatchObject({ code: 'E_VALIDATION' });
  });
  it('writes one owner snapshot across repeated requests and isolates other owners', async () => {
    const req = request();
    const a = await idempotentCreate(req, 'user-a', 'user-a');
    const b = await idempotentCreate(req, 'user-a', 'user-a');
    expect('readingId' in a && a.readingId).toBe('readingId' in b && b.readingId);
    expect(mocked.create).toHaveBeenCalledTimes(1);
    const other = await idempotentCreate(req, 'user-b', 'user-b');
    expect('readingId' in other && other.readingId).not.toBe('readingId' in a && a.readingId);
    expect(mocked.create).toHaveBeenCalledTimes(2);
  });
  it('blocks concurrent duplicate work and underage input before persistence', async () => {
    const req = request();
    const key = `reading:idempotency:${digest('test-ip:' + req.idempotencyKey)}:lock`;
    await redis.set(key, 'busy', 'EX', 30);
    await expect(idempotentCreate(req, 'test-ip')).rejects.toMatchObject({ code: 'E_CONFLICT' });
    await expect(
      generateReading({ ...req, birth: { ...birth, year: 2020 } }, '2026-10-04T00:00:00Z', 'owner'),
    ).rejects.toMatchObject({ code: 'E_AGE_RESTRICTED' });
    expect(mocked.create).not.toHaveBeenCalled();
  });
});
