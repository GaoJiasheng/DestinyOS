import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest';
const state = vi.hoisted(() => ({ db: null as unknown }));
vi.mock('../lib/db', () => ({ getDb: () => state.db }));
import { isolatedSqlite } from '../../../scripts/sqlite-test';
import { fieldEncryptionExtension } from '../lib/db-encryption';
const fixture = isolatedSqlite();
const db = fixture.client.$extends(fieldEncryptionExtension());
state.db = db;
import {
  generateReading,
  idempotentCreate,
  persistReading,
  readingView,
} from '../lib/reading-service';
import { publicShare } from '../lib/share-service';
import { ReportSchema, type ReadingRequest } from '../lib/reading-schema';
import { emphasisEnabled } from '../lib/emphasis';
import {
  EmphasisSchema,
  publicEmphasis,
  regeneratedReading,
  storedEmphasis,
  withEmphasis,
} from '../lib/emphasis-schema';
import { fixtureEmphasis } from './fixtures/emphasis-a';
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
const request = (locale: 'zh' | 'en' = 'zh'): ReadingRequest => ({
  system: 'ziwei',
  locale,
  birth,
  idempotencyKey: crypto.randomUUID(),
});
const now = '2026-11-16T00:00:00Z';
const expected = fixtureEmphasis();
beforeEach(async () => {
  vi.stubEnv('AUTH_SECRET', 'isolated-reading-secret');
  vi.stubEnv('FIELD_ENCRYPTION_KEYS', `v1:${Buffer.alloc(32, 1).toString('base64')}`);
  await fixture.client.ephemeralState.deleteMany();
  await fixture.client.user.deleteMany();
  await fixture.client.user.create({ data: { id: 'owner', locale: 'zh' } });
});
afterAll(async () => {
  await fixture.client.$disconnect();
  await fixture.close();
  vi.unstubAllEnvs();
});

describe('switch', () => {
  it('is on only for FEATURE_EMPHASIS=true', () => {
    vi.stubEnv('FEATURE_EMPHASIS', '');
    expect(emphasisEnabled()).toBe(false);
    for (const value of ['1', 'TRUE', 'yes', 'false']) {
      vi.stubEnv('FEATURE_EMPHASIS', value);
      expect(emphasisEnabled()).toBe(false);
    }
    vi.stubEnv('FEATURE_EMPHASIS', 'true');
    expect(emphasisEnabled()).toBe(true);
    vi.stubEnv('FEATURE_EMPHASIS', '');
  });
  it('generates no emphasis unless a web call site passes the switch', async () => {
    const off = await generateReading(request(), now);
    expect('emphasis' in off.report.headline).toBe(false);
    const created = await idempotentCreate(request(), 'test-ip');
    expect('emphasis' in created.report.headline).toBe(false);
    const on = await generateReading(request(), now, undefined, true);
    expect(on.report.headline.emphasis).toEqual(expected);
    expect({ ...on.report, headline: { ...on.report.headline, emphasis: undefined } }).toEqual({
      ...off.report,
      headline: { ...off.report.headline, emphasis: undefined },
    });
  });
  it('wires the switch into every web generation site and keeps mobile paths off', () => {
    const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
    const actions = read('app/readings/actions.ts');
    expect(actions).toMatch(/idempotentCreate\([^)]*emphasisEnabled\(\)\)/);
    expect(actions).toMatch(/options: \{ emphasis: emphasisEnabled\(\) \}/);
    expect(actions).toMatch(
      /options: \{ emphasis: Boolean\(input\.regenerate\) && emphasisEnabled\(\) \}/,
    );
    expect(read('lib/reading-import.ts')).toMatch(/true,\s*emphasisEnabled\(\),\s*\)/);
    const mobile = (dir: string): string[] =>
      readdirSync(new URL(`../${dir}`, import.meta.url).pathname).flatMap((name) => {
        const path = join(dir, name);
        return statSync(new URL(`../${path}`, import.meta.url).pathname).isDirectory()
          ? mobile(path)
          : [read(path)];
      });
    for (const source of [...mobile('lib/mobile'), ...mobile('app/api/v1/mobile')])
      expect(source).not.toMatch(/emphasis/i);
  });
});

describe('stored reports', () => {
  it('keeps the stored emphasis when another locale is generated later', async () => {
    await persistReading('owner', request(), now, 'zw', undefined, [], null, [], false, true);
    const row = await db.reading.findUniqueOrThrow({ where: { id: 'zw' } });
    expect(ReportSchema.parse(row.reportZh).headline.emphasis).toEqual(expected);
    expect(row.reportEn).toBeNull();
    const en = await readingView(row, 'en', true);
    expect(en.report.locale).toBe('en');
    expect(en.report.headline.emphasis).toEqual(expected);
    const tw = await readingView(row, 'zh-TW', true);
    expect(tw.report.headline.emphasis).toEqual(expected);
    const saved = await db.reading.findUniqueOrThrow({ where: { id: 'zw' } });
    expect(storedEmphasis(saved.reportEn)).toEqual(expected);
  });
  it('translates an old report without emphasis without adding one', async () => {
    await persistReading('owner', request(), now, 'old');
    const row = await db.reading.findUniqueOrThrow({ where: { id: 'old' } });
    const en = await readingView(row, 'en', true);
    expect('emphasis' in en.report.headline).toBe(false);
  });
  it('projects only the strongest dimension into the public share', async () => {
    await persistReading('owner', request(), now, 'shared', undefined, [], null, [], false, true);
    const token = 'A'.repeat(22);
    await db.shareLink.create({
      data: { token, readingId: 'shared', userId: 'owner', template: 'chart', revealLevel: 2 },
    });
    for (const locale of ['zh', 'en', 'zh-TW'] as const) {
      const share = await publicShare(token, locale);
      expect(share.emphasis).toEqual({ dim: 'career', level: 4 });
      const text = JSON.stringify(share);
      for (const hidden of ['basis', '"raw"', 'ruleId', 'zw.z', '"omitted"', '多花心思'])
        expect(text).not.toContain(hidden);
      expect(text).not.toContain('Takes more care');
      expect(Object.keys(share.emphasis ?? {})).toEqual(['dim', 'level']);
    }
  });
});

type LooseDim = { level: unknown; basis: { params: Record<string, string> }[] };
type Loose = {
  dims: { career: LooseDim; love: LooseDim; [key: string]: LooseDim };
  top: unknown;
  [key: string]: unknown;
};
describe('schema', () => {
  const report = async () => (await generateReading(request(), now, undefined, true)).report;
  it('accepts and keeps a valid emphasis, and omits the key when absent', async () => {
    const valid = await report();
    expect(ReportSchema.parse(valid).headline.emphasis).toEqual(expected);
    const bare = withEmphasis(valid, undefined);
    expect('emphasis' in bare.headline).toBe(false);
    expect('emphasis' in ReportSchema.parse(bare).headline).toBe(false);
  });
  it.each([
    ['band 1', (e: Loose) => (e.dims.career.level = 1)],
    ['band 6', (e: Loose) => (e.dims.career.level = 6)],
    ['unknown dimension', (e: Loose) => (e.dims.luck = e.dims.career)],
    ['extra field', (e: Loose) => (e.score = 4)],
    ['numeric string level', (e: Loose) => (e.dims.love.level = '3')],
    [
      'too many basis entries',
      (e: Loose) => (e.dims.career.basis = Array(25).fill(e.dims.career.basis[0])),
    ],
    ['overlong parameter', (e: Loose) => (e.dims.career.basis[0]!.params.palace = 'x'.repeat(161))],
    ['three top dimensions', (e: Loose) => (e.top = ['career', 'social', 'love'])],
  ])('rejects %s', (_, mutate) => {
    const value = structuredClone(expected) as unknown as Loose;
    mutate(value);
    expect(EmphasisSchema.safeParse(value).success).toBe(false);
  });
});

describe('public projection helpers', () => {
  it('never exposes bands 2–3, basis or raw values', () => {
    expect(publicEmphasis(expected)).toEqual({ dim: 'career', level: 4 });
    expect(publicEmphasis({ ...expected, top: [] })).toBeUndefined();
    expect(publicEmphasis({ ...expected, top: ['wealth'] })).toBeUndefined();
    expect(publicEmphasis({ ...expected, top: ['love'] })).toBeUndefined();
    expect(publicEmphasis(undefined)).toBeUndefined();
  });
  it('syncs one emphasis across every cached device locale after regeneration', async () => {
    const zh = await report();
    const old = withEmphasis(zh, undefined);
    const reading = { report: old, reportZh: old, reportEn: { ...old, locale: 'en' as const } };
    const next = regeneratedReading(reading, 'zh', zh);
    expect(next.reportZh?.headline.emphasis).toEqual(expected);
    expect(next.reportEn?.headline.emphasis).toEqual(expected);
    expect(withEmphasis(old, undefined)).toBe(old);
  });
  async function report() {
    return (await generateReading(request(), now, undefined, true)).report;
  }
});
