import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest';
const state = vi.hoisted(() => ({ db: null as unknown }));
vi.mock('../lib/db', () => ({ getDb: () => state.db }));
import { isolatedSqlite } from '../../../scripts/sqlite-test';
import { fieldEncryptionExtension } from '../lib/db-encryption';
const fixture = isolatedSqlite();
const db = fixture.client.$extends(fieldEncryptionExtension());
state.db = db;
import { computeTarot } from '@tianji/engine/tarot';
import {
  generateReading,
  idempotentCreate,
  digest,
  persistReading,
  readingView,
  json,
} from '../lib/reading-service';
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
  vi.stubEnv('AUTH_SECRET', 'isolated-reading-secret');
  vi.stubEnv('FIELD_ENCRYPTION_KEYS', `v1:${Buffer.alloc(32, 1).toString('base64')}`);
  await fixture.client.ephemeralState.deleteMany();
  await fixture.client.user.deleteMany();
  for (const id of ['owner', 'user-a', 'user-b'])
    await fixture.client.user.create({ data: { id } });
});
afterAll(async () => {
  await fixture.client.$disconnect();
  await fixture.close();
  vi.unstubAllEnvs();
});
describe('reading pipeline and idempotency', () => {
  it('persists tarot choices and reversal controls with the same seeded chart as the client', async () => {
    const req: ReadingRequest = {
      system: 'tarot',
      locale: 'en',
      seed: 'test-seed-001',
      spread: 'three_ppf',
      category: 'decision',
      question: 'Private tarot question',
      allowReversed: false,
      pickedIndices: [7, 13, 42],
      idempotencyKey: crypto.randomUUID(),
    };
    const expected = computeTarot({
      seed: req.seed!,
      spread: 'three_ppf',
      category: 'decision',
      question: 'Private tarot question',
      allowReversed: false,
      pickedIndices: req.pickedIndices,
    });
    const result = await generateReading(req, '2026-10-05T00:00:00Z');
    expect(result.chart).toEqual(expected);
    expect(result.report.sections.slice(0, 6).map((section) => section.key)).toEqual([
      'overview',
      'cards',
      'dynamics',
      'answer',
      'advice',
      'learn',
    ]);
    expect(JSON.stringify(result.chart)).not.toContain('Private tarot question');
    expect(result.meta.schoolUsed).toMatchObject({ deck: 'rws', allowReversed: false });
  });

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
      expect(await db.reading.count()).toBe(0);
    },
  );
  it('repeats anonymous requests deterministically and caches no birth input or report text', async () => {
    const req = request();
    const a = await idempotentCreate(req, 'test-ip');
    const b = await idempotentCreate(req, 'test-ip');
    expect(a).toEqual(b);
    const keys = (
      await fixture.client.ephemeralState.findMany({
        where: { key: { startsWith: 'reading:idempotency:' } },
      })
    ).map((r) => r.key);
    expect(keys).toHaveLength(1);
    const value = (
      await fixture.client.ephemeralState.findUniqueOrThrow({ where: { key: keys[0]! } })
    ).value;
    expect(value).not.toContain('Beijing');
    expect(value).not.toContain('1990');
    expect(await db.reading.count()).toBe(0);
    await expect(
      idempotentCreate({ ...req, birth: { ...birth, day: 16 } }, 'test-ip'),
    ).rejects.toMatchObject({ code: 'E_VALIDATION' });
  });
  it('writes one owner snapshot across repeated requests and isolates other owners', async () => {
    const req = request();
    const a = await idempotentCreate(req, 'user-a', 'user-a');
    const b = await idempotentCreate(req, 'user-a', 'user-a');
    expect('readingId' in a && a.readingId).toBe('readingId' in b && b.readingId);
    expect(await db.reading.count()).toBe(1);
    const other = await idempotentCreate(req, 'user-b', 'user-b');
    expect('readingId' in other && other.readingId).not.toBe('readingId' in a && a.readingId);
    expect(await db.reading.count()).toBe(2);
  });
  it('blocks concurrent duplicate work and underage input before persistence', async () => {
    const req = request();
    const key = `reading:idempotency:${digest('test-ip:' + req.idempotencyKey)}:lock`;
    await fixture.client.ephemeralState.create({
      data: { key, value: 'busy', expiresAt: Date.now() + 30000 },
    });
    await expect(idempotentCreate(req, 'test-ip')).rejects.toMatchObject({ code: 'E_CONFLICT' });
    await expect(
      generateReading({ ...req, birth: { ...birth, year: 2020 } }, '2026-10-04T00:00:00Z', 'owner'),
    ).rejects.toMatchObject({ code: 'E_AGE_RESTRICTED' });
    expect(await db.reading.count()).toBe(0);
  });
});

describe('free history retention', () => {
  async function history() {
    const generated = await generateReading(request(), '2026-10-04T00:00:00Z');
    await db.reading.createMany({
      data: Array.from({ length: 53 }, (_, index) => ({
        id: `history-${index}`,
        userId: 'owner',
        system: 'bazi',
        encInput: JSON.stringify(request()),
        chart: json(generated.chart),
        reportZh: json(generated.report),
        schoolUsed: {},
        engineVersion: '1',
        interpretVersion: '1',
        knowledgeVersion: '1',
        isPublic: index === 51,
        createdAt: new Date(Date.now() - (index + 1) * 1000),
      })),
    });
  }
  it('retains newest fifty and protects older public reports while pruning private excess', async () => {
    await history();
    await persistReading('owner', request(), '2026-10-04T00:00:00Z', 'new-reading');
    expect(await db.reading.count()).toBe(51);
    expect(await db.reading.findUnique({ where: { id: 'history-51' } })).not.toBeNull();
    expect(await db.reading.findUnique({ where: { id: 'history-52' } })).toBeNull();
  });
  it('keeps unlimited subscriber history', async () => {
    await db.user.update({ where: { id: 'owner' }, data: { plan: 'pro' } });
    await history();
    await persistReading('owner', request(), '2026-10-04T00:00:00Z', 'new-reading');
    expect(await db.reading.count()).toBe(54);
  });
});

it('stores the canonical zh snapshot for zh-TW and reads either locale without cache pollution', async () => {
  const req = { ...request(), locale: 'zh-TW' as const };
  const result = await persistReading('owner', req, '2026-10-05T00:00:00Z', 'tw-report');
  expect(result.report.locale).toBe('zh-TW');
  const row = await db.reading.findUniqueOrThrow({ where: { id: 'tw-report' } });
  expect(row.reportEn).toBeNull();
  expect(row.reportZh).toMatchObject({ locale: 'zh' });
  const zh = await readingView(row, 'zh', true);
  const tw = await readingView(row, 'zh-TW', true);
  expect(zh.report.locale).toBe('zh');
  expect(tw.report.locale).toBe('zh-TW');
  expect(tw.report.hits).toEqual(zh.report.hits);
  expect(JSON.stringify(row.reportZh)).not.toContain('"locale":"zh-TW"');
});
