import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFile } from 'node:fs/promises';
import { normalizeBirth, computeBazi } from '@tianji/engine';
import { projectShare, DailyCardSchema } from '../lib/share-projection';
import { signDailyCard, verifyDailyCard } from '../lib/share-service';
import { calculateDaily, dailyCacheKey, dailyTTL, localToday } from '../lib/daily-compute';
import { SettingsSchema } from '../lib/account-service-schema';
import { loadKnowledge } from '../lib/knowledge';
import { learnContent, structuredJson } from '../lib/learn';
import type { BirthInput } from '@tianji/shared';
const birth: BirthInput = {
  calendar: 'gregorian',
  year: 1990,
  month: 5,
  day: 15,
  hour: 8,
  minute: 30,
  timeUnknown: false,
  gender: 'male',
  place: { name: 'Beijing', lat: 39.9, lng: 116.4, tz: 'Asia/Shanghai' },
};
beforeEach(() => {
  vi.stubEnv('DATABASE_URL', '');
  vi.stubEnv('AUTH_SECRET', 'unit-test-secret');
});
describe('daily and public privacy contracts', () => {
  it('uses local dates across the international date line and expires through DST at next 02:00', () => {
    expect(localToday('America/New_York', '2026-10-05T01:00:00Z')).toBe('2026-10-04');
    expect(localToday('Asia/Tokyo', '2026-10-05T01:00:00Z')).toBe('2026-10-05');
    expect(dailyTTL('2026-03-07', 'America/New_York', '2026-03-07T17:00:00Z')).toBe(14 * 3600);
    expect(dailyTTL('2026-10-04', 'Asia/Shanghai', '2026-10-04T04:00:00Z')).toBe(14 * 3600);
    expect(dailyTTL('2026-10-03', 'Asia/Shanghai', '2026-10-04T04:00:00Z')).toBe(60);
    expect(dailyCacheKey('user', 3, '2026-10-04', 'en', 'kv', 'ev')).toBe(
      'daily:user:3:2026-10-04:en:kv:ev',
    );
  });
  it('runs anonymous calculation offline and yields bilingual short actions and stable cards', async () => {
    const knowledge = await loadKnowledge('daily', 'zh');
    const zh = calculateDaily(
        birth,
        '2026-10-04',
        'Asia/Shanghai',
        'fixture-daily',
        'zh',
        knowledge,
      ),
      en = calculateDaily(birth, '2026-10-04', 'Asia/Shanghai', 'fixture-daily', 'en', knowledge);
    expect(zh.chart).toEqual(en.chart);
    expect(zh.report.sections).toHaveLength(10);
    expect(en.report.doDont?.do).toHaveLength(3);
    for (const text of en.report.doDont?.do ?? [])
      expect(text.split(/\s+/).length).toBeLessThanOrEqual(3);
    expect(zh.chart.bazi.goodHours).toHaveLength(2);
    expect(zh.chart.date.local).toBe('2026-10-04');
  });
  it('never inspects chart at revealLevel zero and suppresses birthday text in both page/image projections', async () => {
    const bundle = await loadKnowledge('daily', 'en'),
      report = calculateDaily(birth, '2026-10-04', 'Asia/Shanghai', 'privacy', 'en', bundle).report;
    report.headline.persona = 'A reflection for 1990-05-15 08:30';
    report.headline.keywords = ['1990年5月15日'];
    report.sections[0]!.blocks.push({
      type: 'paragraph',
      text: 'Hidden 1990-05-15 Beijing',
      unitId: 'test',
      polarity: 'neutral',
    });
    const poison = new Proxy(
      {},
      {
        get() {
          throw new Error('Private chart touched');
        },
      },
    );
    const safe = projectShare('bazi', poison, report, 'quote', 0);
    expect(JSON.stringify(safe)).not.toMatch(
      /1990-05-15|1990年5月15日|08:30|Beijing|sections|diagram|birth|encInput/,
    );
    const { cardText } = await import('../lib/og-card');
    expect(cardText(safe).join(' ')).not.toMatch(/1990-05-15|08:30|Beijing/);
  });
  it('projects only derived chart fields at level one and report prose only at level two', async () => {
    const normalized = normalizeBirth(birth),
      chart = computeBazi(normalized, { now: '2026-10-04T00:00:00Z' }),
      report = calculateDaily(
        birth,
        '2026-10-04',
        'Asia/Shanghai',
        'privacy',
        'en',
        await loadKnowledge('daily', 'en'),
      ).report;
    const one = projectShare('bazi', chart, report, 'chart', 1),
      two = projectShare('bazi', chart, report, 'quote', 2);
    expect(one.diagram?.kind).toBe('pillars');
    expect(one.sections).toBeUndefined();
    expect(two.sections).toHaveLength(10);
    expect(JSON.stringify(one)).not.toMatch(
      /1990-05-15|Beijing|solarTimeAdjust|encInput|createdAt/,
    );
    expect(() => projectShare('bazi', chart, report, 'chart', 3)).toThrow();
  });
  it('authenticates HMAC parameters, rejects tampering, expiry and birth-bearing payloads', () => {
    const input = DailyCardSchema.parse({
      locale: 'en',
      date: '2026-10-04',
      headline: 'A measured step',
      stars: 4,
      color: 'Teal',
      numbers: [3, 8],
      do: ['Listen'],
      dont: ['Rush'],
    });
    const signed = signDailyCard(input, 1000000);
    expect(verifyDailyCard(signed.payload, signed.signature, 1000000)).toEqual(input);
    expect(() => verifyDailyCard(signed.payload + 'A', signed.signature, 1000000)).toThrow();
    expect(() => verifyDailyCard(signed.payload, signed.signature, 1000000 + 86401000)).toThrow();
    expect(() => signDailyCard({ ...input, birth } as typeof input)).toThrow();
  });
  it('rejects invalid settings, loads all encyclopedia entries and escapes script markup', async () => {
    expect(SettingsSchema.safeParse({ tz: 'Mars/Olympus' }).success).toBe(false);
    expect(SettingsSchema.safeParse({ theme: 'east', tz: 'Asia/Singapore' }).success).toBe(true);
    expect(SettingsSchema.safeParse({ plan: 'pro' }).success).toBe(false);
    const content = await learnContent();
    expect(content.systems).toHaveLength(9);
    expect(content.articles).toHaveLength(27);
    expect(content.cards).toHaveLength(78);
    expect(content.hexagrams).toHaveLength(64);
    // DESIGN-GAP: The documented glossary count is approximate; added bilingual terms must remain publishable.
    expect(content.glossary.length).toBeGreaterThanOrEqual(600);
    expect(new Set(content.glossary.map((entry) => entry.key)).size).toBe(content.glossary.length);
    expect(content.glossary.map((entry) => entry.key)).toEqual(
      expect.arrayContaining([
        'pattern.yod',
        'pattern.zi_fu_chao_yuan',
        'pattern.fu_xiang_chao_yuan',
      ]),
    );
    expect(structuredJson({ text: '</script>' })).not.toContain('</script>');
    expect((await readFile('apps/web/resources/og-font.ttf')).length).toBeGreaterThan(1000);
  });
});
