import { beforeAll, describe, expect, it } from 'vitest';
import { Graha, Nakshatra, Sign } from '@tianji/shared';
import { YOGA_CONDITIONS } from '../../engine/src';
import { interpret } from '../../interpret/src';
import { conditions, equal, evaluateWhen, resolvePath } from '../src';
import { auditVedicCoverage, vedicCoverageNow } from '../scripts/vedic-coverage';

let audit: Awaited<ReturnType<typeof auditVedicCoverage>>;
beforeAll(async () => {
  audit = await auditVedicCoverage(50);
}, 120_000);

describe('published Vedic knowledge', () => {
  it('covers every documented combination, including two variants per Moon sector and quarter', () => {
    const units = audit.knowledge.units.filter((u) => u.system === 'vedic');
    const ids = new Set(units.map((u) => u.id));
    for (const mansion of Nakshatra)
      for (const pada of [1, 2, 3, 4])
        for (const variant of ['a', 'b'])
          expect(ids.has(`vedic.moon.${mansion}.pada_${pada}.${variant}`)).toBe(true);
    for (const planet of Object.values(Graha)) {
      for (const sign of Object.values(Sign))
        expect(ids.has(`vedic.planet_sign.${planet}.${sign}`)).toBe(true);
      for (let house = 1; house <= 12; house++)
        expect(ids.has(`vedic.planet_house.${planet}.house_${house}`)).toBe(true);
      expect(ids.has(`vedic.mahadasha.${planet}`)).toBe(true);
      for (const sublord of Object.values(Graha))
        expect(ids.has(`vedic.antardasha.${planet}.${sublord}`)).toBe(true);
    }
    for (const sign of Object.values(Sign)) {
      expect(ids.has(`vedic.lagna.${sign}`)).toBe(true);
      for (const role of ['moon', 'venus', 'lagna'])
        expect(ids.has(`vedic.navamsa.${role}.${sign}`)).toBe(true);
    }
    for (let source = 1; source <= 12; source++)
      for (let destination = 1; destination <= 12; destination++)
        expect(ids.has(`vedic.house_lord.house_${source}.in_${destination}`)).toBe(true);
    for (const key of Object.keys(YOGA_CONDITIONS)) expect(ids.has(`vedic.yoga.${key}`)).toBe(true);
    expect(units).toHaveLength(812);
  });

  it('resolves all conditions on engine output without invented feature paths', () => {
    for (const unit of audit.knowledge.units.filter((u) => u.system === 'vedic'))
      for (const condition of conditions(unit.when)) {
        expect(condition.path.startsWith('features.')).toBe(false);
        expect(audit.charts.some((chart) => resolvePath(chart, condition.path, true).length)).toBe(
          true,
        );
      }
  });

  it('does not combine a house ruler with a different planet’s placement', () => {
    const chart = structuredClone(audit.charts.find((c) => c.houses)!);
    const unit = audit.knowledge.units.find((u) => u.id === 'vedic.house_lord.house_1.in_10')!;
    chart.houses![0]!.lord = 'mangala';
    chart.bodies.find((b) => b.key === 'mangala')!.house = 3;
    chart.bodies.find((b) => b.key === 'budha')!.house = 10;
    expect(evaluateWhen(chart, unit.when).matched).toBe(false);
    chart.bodies.find((b) => b.key === 'mangala')!.house = 10;
    expect(evaluateWhen(chart, unit.when).matched).toBe(true);
  });

  it('keeps the current Antardasha under its own current Mahadasha', () => {
    const units = audit.knowledge.units.filter((u) => u.id.startsWith('vedic.antardasha.'));
    for (const chart of audit.charts) {
      const main = chart.dasha.sequence.find((p) => p.current);
      const sub = main?.antar.find((p) => p.current);
      expect(units.filter((u) => evaluateWhen(chart, u.when).matched).map((u) => u.id)).toEqual(
        sub ? [`vedic.antardasha.${main!.lord}.${sub.lord}`] : [],
      );
    }
  });

  it('has distinct original variants with reciprocal exclusions and stable bilingual selection', () => {
    const variants = audit.knowledge.units.filter((u) => u.id.startsWith('vedic.moon.'));
    for (const unit of variants) {
      const other = variants.find((u) => u.id === unit.exclusive_with[0])!;
      expect(equal(unit.when, other.when)).toBe(true);
      expect(other.exclusive_with).toEqual([unit.id]);
      expect(unit.zh.body).not.toEqual(other.zh.body);
      expect(unit.en.body).not.toEqual(other.en.body);
    }
    const chart = audit.charts[0]!;
    const selected = new Set<string>();
    for (let index = 0; index < 8; index++) {
      const input = {
        system: 'vedic' as const,
        chart,
        knowledge: audit.knowledge,
        context: {
          now: vedicCoverageNow,
          profileHasTime: !chart.noonChart,
          userId: `vedic-sample-${index}`,
        },
      };
      const zh = interpret({ ...input, locale: 'zh' });
      const en = interpret({ ...input, locale: 'en' });
      expect(zh.hits).toEqual(en.hits);
      expect(interpret({ ...input, locale: 'zh' })).toEqual(zh);
      const hits = zh.hits.filter((h) => h.unitId.startsWith('vedic.moon.'));
      expect(hits).toHaveLength(1);
      selected.add(hits[0]!.unitId);
    }
    expect(selected.size).toBe(2);
  });

  it('provides eight readable chapters in both languages for A–G, fifty births and boundaries', () => {
    expect(audit.coverageErrors).toEqual([]);
    expect(Object.values(audit.statistics.emptySections)).toEqual(Array<number>(8).fill(0));
    expect(audit.statistics.readabilityIssues).toEqual({});
    expect(audit.statistics.zhChars.min).toBeGreaterThanOrEqual(2500);
    expect(audit.statistics.enWords.min).toBeGreaterThanOrEqual(1800);
    expect(audit.statistics.maxTermDensity).toBeLessThanOrEqual(6);
    expect(audit.statistics.unknownTimeCharts).toBeGreaterThan(0);
    expect(audit.statistics.outsideCurrentPeriodCharts).toBeGreaterThan(0);
  });

  it('offers a weak fallback per chapter and does not invent precise noon-chart placements', () => {
    for (const section of Object.keys(audit.statistics.bySection)) {
      const fallback = audit.knowledge.units.find((u) => u.id === `vedic.fallback.${section}`)!;
      expect(fallback.weight).toBe(1);
      expect(audit.charts.every((chart) => evaluateWhen(chart, fallback.when).matched)).toBe(true);
    }
    for (const chart of audit.charts.filter((c) => c.noonChart)) {
      const report = interpret({
        system: 'vedic',
        chart,
        locale: 'zh',
        knowledge: audit.knowledge,
        context: { now: vedicCoverageNow, profileHasTime: false },
      });
      expect(
        report.hits.some((h) =>
          /^vedic\.(lagna|planet_house|house_lord|navamsa|antardasha)\./.test(h.unitId),
        ),
      ).toBe(false);
      expect(report.hits.some((h) => h.unitId === 'vedic.unknown_time.houses')).toBe(true);
      expect(report.hits.some((h) => h.unitId === 'vedic.unknown_time.navamsa')).toBe(true);
    }
  });
});
