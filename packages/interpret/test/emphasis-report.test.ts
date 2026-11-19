import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { KnowledgeBundle } from '@tianji/content';
import { computeZiwei, normalizeBirth } from '@tianji/engine';
import { BirthInputSchema } from '@tianji/shared';
import { interpret, localizeReport, systemConfigs, ziweiEmphasis } from '../src';
const knowledge = JSON.parse(
  readFileSync('packages/content/dist/ziwei.zh.json', 'utf8'),
) as KnowledgeBundle;
const chartOf = (id: string) =>
  computeZiwei({
    birth: normalizeBirth(
      BirthInputSchema.parse(
        JSON.parse(readFileSync(`packages/engine/test/fixtures/birth/${id}.json`, 'utf8')),
      ),
    ),
    now: '2026-11-16T00:00:00Z',
  });
const context = { now: '2026-11-16T00:00:00Z', profileHasTime: true, engineVersion: '0.4.1' };
describe('interpret emphasis switch', () => {
  it('leaves reports byte-identical when the switch is absent or false', () => {
    for (const id of ['A', 'D']) {
      const chart = chartOf(id);
      for (const locale of ['zh', 'en', 'zh-TW'] as const) {
        const base = interpret({ system: 'ziwei', chart, locale, knowledge, context });
        const off = interpret({
          system: 'ziwei',
          chart,
          locale,
          knowledge,
          context,
          options: { emphasis: false },
        });
        expect(JSON.stringify(off)).toBe(JSON.stringify(base));
        expect(Object.keys(base.headline)).toEqual(['persona', 'keywords', 'scores', 'confidence']);
        // headline.scores is deliberately untouched (flat 3s for natal charts).
        expect(new Set(Object.values(base.headline.scores))).toEqual(new Set([3]));
      }
    }
  });
  it('adds only headline.emphasis when on; the rest of the report is unchanged', () => {
    const chart = chartOf('A');
    const base = interpret({ system: 'ziwei', chart, locale: 'zh', knowledge, context });
    const on = interpret({
      system: 'ziwei',
      chart,
      locale: 'zh',
      knowledge,
      context,
      options: { emphasis: true },
    });
    const { emphasis, ...headline } = on.headline;
    expect(emphasis).toEqual(ziweiEmphasis(chart));
    expect({ ...on, headline }).toEqual(base);
    expect(on.headline.scores).toEqual(base.headline.scores);
  });
  it('produces identical emphasis for zh, en and zh-TW, and localizeReport keeps the stored value', () => {
    for (const id of 'ABCDFG') {
      const chart = chartOf(id);
      const [zh, en, tw] = (['zh', 'en', 'zh-TW'] as const).map(
        (locale) =>
          interpret({
            system: 'ziwei',
            chart,
            locale,
            knowledge,
            context,
            options: { emphasis: true },
          }).headline.emphasis,
      );
      expect(zh).toBeDefined();
      expect(en).toEqual(zh);
      expect(tw).toEqual(zh);
    }
    const report = interpret({
      system: 'ziwei',
      chart: chartOf('A'),
      locale: 'zh',
      knowledge,
      context,
      options: { emphasis: true },
    });
    // A stored report keeps its original rule version and basis; switching language never rescoring.
    const stored = {
      ...report,
      headline: {
        ...report.headline,
        emphasis: { ...report.headline.emphasis!, version: '0.9.0' },
      },
    };
    expect(localizeReport(stored, 'zh-TW').headline.emphasis).toBe(stored.headline.emphasis);
  });
  it('declares emphasis support explicitly per system', () => {
    expect(
      Object.fromEntries(Object.entries(systemConfigs).map(([s, c]) => [s, c.emphasis.status])),
    ).toEqual({
      bazi: 'deferred',
      ziwei: 'available',
      iching: 'not_applicable',
      qimen: 'not_applicable',
      tarot: 'not_applicable',
      astrology: 'deferred',
      vedic: 'deferred',
      numerology: 'not_applicable',
      daily: 'not_applicable',
      synastry: 'not_applicable',
    });
  });
  it('ignores the switch for systems without emphasis and rejects non-Zi Wei charts', () => {
    expect(() => ziweiEmphasis({ palaces: [] })).toThrow('valid Zi Wei chart');
    const bazi = JSON.parse(
      readFileSync('packages/content/dist/bazi.zh.json', 'utf8'),
    ) as KnowledgeBundle;
    const chart = JSON.parse(
      readFileSync('packages/content/test/fixtures/bazi.engine-a.json', 'utf8'),
    ) as unknown;
    const report = interpret({
      system: 'bazi',
      chart,
      locale: 'zh',
      knowledge: bazi,
      context,
      options: { emphasis: true },
    });
    expect(report.headline.emphasis).toBeUndefined();
    expect('emphasis' in report.headline).toBe(false);
  });
});
