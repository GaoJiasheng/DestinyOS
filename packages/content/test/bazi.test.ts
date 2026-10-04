import { beforeAll, describe, expect, it } from 'vitest';
import {
  Stem,
  TenGod,
  Branch,
  LifeStage,
  Element,
  PatternKeySchema,
  ShenShaNameSchema,
  BaziFeaturesSchema,
} from '@tianji/shared';
import { interpret } from '../../interpret/src';
import plan from '../../interpret/src/plans/bazi.json';
import { loadContent } from '../scripts/load';
import { randomBaziCharts, coverageNow } from '../scripts/bazi-coverage';
import { conditions, evaluateWhen } from '../src';
import version from '../version.json';

describe('published bazi editorial corpus', () => {
  let content: Awaited<ReturnType<typeof loadContent>>;
  beforeAll(async () => {
    content = await loadContent();
  });
  it('covers every documented dimension and the real boolean feature keys', () => {
    const units = content.units.filter((u) => u.system === 'bazi');
    expect(units).toHaveLength(346);
    expect(units.every((u) => u.meta.status === 'published')).toBe(true);
    const ids = new Set(units.map((u) => u.id));
    for (const stem of Object.values(Stem)) {
      expect(ids.has(`bazi.day_master.${stem}`)).toBe(true);
      expect(ids.has(`bazi.overview.${stem}`)).toBe(true);
      for (const level of ['strong', 'balanced', 'weak']) {
        const a = units.find((u) => u.id === `bazi.day_master_strength.${stem}.${level}.a`);
        const b = units.find((u) => u.id === `bazi.day_master_strength.${stem}.${level}.b`);
        expect(a?.when).toEqual(b?.when);
        expect(a?.exclusive_with).toEqual([b?.id]);
        expect(b?.exclusive_with).toEqual([a?.id]);
        expect(a?.zh.body).not.toEqual(b?.zh.body);
        expect(a?.en.body).not.toEqual(b?.en.body);
      }
    }
    for (const pattern of PatternKeySchema.options)
      for (const section of ['pattern_career', 'wealth', 'love'])
        expect(ids.has(`bazi.pattern.${pattern}.${section}`)).toBe(true);
    for (const god of Object.values(TenGod)) {
      for (const context of ['visible', 'hidden', 'strong', 'weak', 'relationship', 'presence'])
        expect(ids.has(`bazi.ten_gods.${god}.${context}`)).toBe(true);
      for (const period of ['decade', 'annual'])
        for (const level of ['strong', 'weak'])
          expect(ids.has(`bazi.${period}.${god}.${level}`)).toBe(true);
    }
    for (const element of Object.values(Element)) {
      for (const state of ['excess', 'missing'])
        for (const section of ['elements', 'health'])
          expect(ids.has(`bazi.element.${element}.${state}.${section}`)).toBe(true);
      for (const kind of ['favorable', 'unfavorable'])
        expect(ids.has(`bazi.use_god.${element}.${kind}`)).toBe(true);
    }
    for (const name of ShenShaNameSchema.options)
      expect(ids.has(`bazi.shen_sha.${name}`)).toBe(true);
    for (const branch of Object.values(Branch))
      expect(ids.has(`bazi.day_branch.${branch}`)).toBe(true);
    for (const stage of Object.values(LifeStage))
      expect(ids.has(`bazi.life_stage.${stage}`)).toBe(true);
    const featurePaths = new Set(
      units
        .flatMap((u) => conditions(u.when).map((c) => c.path))
        .filter((p) => p.startsWith('features.')),
    );
    expect(featurePaths).toEqual(
      new Set(Object.keys(BaziFeaturesSchema.shape).map((key) => `features.${key}`)),
    );
    expect(content.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
  });
  // DESIGN-GAP: The 600-term glossary increases this 24-report integration's coverage-time cost;
  // allow 60s while retaining all twelve charts, both locales and every original assertion.
  it('keeps every chapter populated in both locales and selects only one strength variant', () => {
    if (!content.transitions) throw new Error('Missing transitions');
    const fallbacks = content.units.filter((u) => u.id.startsWith('bazi.fallback.'));
    expect(new Set(fallbacks.map((u) => u.section))).toEqual(new Set(plan.map((s) => s.key)));
    expect(fallbacks.every((u) => u.weight === 1)).toBe(true);
    for (const chart of randomBaziCharts(12)) {
      expect(fallbacks.every((u) => evaluateWhen(chart, u.when).matched)).toBe(true);
      for (const locale of ['zh', 'en'] as const) {
        const report = interpret({
          system: 'bazi',
          chart,
          locale,
          knowledge: { ...version, ...content, transitions: content.transitions },
          context: { now: coverageNow, profileHasTime: chart.pillars.hour !== null },
        });
        expect(report.sections.map((s) => s.key)).toEqual(plan.map((s) => s.key));
        for (const section of report.sections)
          expect(report.hits.some((h) => h.section === section.key)).toBe(true);
        expect(
          report.hits.filter((h) => h.unitId.startsWith('bazi.day_master_strength.')),
        ).toHaveLength(1);
        expect(report.readability.passed).toBe(true);
      }
    }
  }, 60_000);
});
