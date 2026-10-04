import { beforeAll, describe, expect, it } from 'vitest';
import {
  GateSchema,
  StarSchema,
  DeitySchema,
  QimenFlagSchema,
} from '../../shared/src/schemas/charts/qimen';
import { PATTERN_RULES } from '../../engine/src/qimen';
import { interpret } from '../../interpret/src';
import {
  conditions,
  evaluateWhen,
  equal,
  resolvePath,
  similarity,
  trigrams,
  trigramSimilarity,
} from '../src';
import { auditQimen } from '../scripts/check-qimen-coverage';

let audit: Awaited<ReturnType<typeof auditQimen>>;
beforeAll(async () => {
  audit = await auditQimen(50);
}, 30_000);

describe('published Qimen knowledge', () => {
  it('covers every documented symbol dimension and all forty category verdicts', () => {
    const ids = new Set(audit.knowledge.units.map((u) => u.id));
    for (const pattern of PATTERN_RULES)
      expect(ids.has(`qimen.patterns.${pattern.key}`)).toBe(true);
    for (const key of GateSchema.options) expect(ids.has(`qimen.gates.${key}`)).toBe(true);
    for (const key of StarSchema.options) expect(ids.has(`qimen.stars.${key}`)).toBe(true);
    for (const key of DeitySchema.options) expect(ids.has(`qimen.deities.${key}`)).toBe(true);
    for (const key of QimenFlagSchema.options) expect(ids.has(`qimen.flags.${key}`)).toBe(true);
    expect([...ids].filter((id) => id.startsWith('qimen.verdict.'))).toHaveLength(40);
    expect(audit.statistics.units).toBe(225);
  });

  it('resolves every predicate on real engine charts and has no fabricated category or features path', () => {
    for (const unit of audit.knowledge.units.filter((u) => u.system === 'qimen')) {
      for (const condition of conditions(unit.when)) {
        expect(condition.path.startsWith('category')).toBe(false);
        expect(condition.path.startsWith('features.')).toBe(false);
        expect(
          audit.samples.some(({ chart }) => resolvePath(chart, condition.path, true).length > 0),
        ).toBe(true);
      }
    }
  });

  it('matches exactly one category verdict on each computed chart', () => {
    for (const { chart, category } of audit.samples) {
      const hits = audit.knowledge.units.filter(
        (u) => u.id.startsWith('qimen.verdict.') && evaluateWhen(chart, u.when).matched,
      );
      expect(hits.map((u) => u.id)).toEqual([`qimen.verdict.${category}.${chart.verdict}`]);
    }
  });

  it('has complete, readable bilingual reports for A–G and fifty legal random births', () => {
    expect(audit.coverageErrors).toEqual([]);
    expect(Object.values(audit.statistics.emptySections)).toEqual([0, 0, 0, 0, 0, 0]);
    expect(audit.statistics.readabilityIssues).toEqual({});
    expect(audit.statistics.zhChars.min).toBeGreaterThanOrEqual(1200);
    expect(audit.statistics.enWords.min).toBeGreaterThanOrEqual(900);
  });

  it('keeps six readable chapters even when only weak fallbacks are available', () => {
    const knowledge = {
      ...audit.knowledge,
      units: audit.knowledge.units.filter(
        (u) => u.id.startsWith('qimen.fallback.') || u.system === 'common',
      ),
    };
    for (const locale of ['zh', 'en'] as const) {
      const report = interpret({
        system: 'qimen',
        chart: audit.samples[0]!.chart,
        knowledge,
        locale,
        context: { now: '2026-10-04', profileHasTime: true },
      });
      expect(report.hits).toHaveLength(6);
      expect(
        report.sections
          .slice(0, 6)
          .every((s) => s.lead && s.blocks.some((b) => b.type === 'paragraph')),
      ).toBe(true);
      expect(report.readability.passed).toBe(true);
    }
  });

  it('provides two original variants with the same predicate and reciprocal exclusion for every indicator state', () => {
    const variants = audit.knowledge.units.filter((u) => u.id.startsWith('qimen.use_gods.'));
    expect(variants).toHaveLength(68);
    for (const unit of variants) {
      const other = variants.find((u) => u.id === unit.exclusive_with[0]);
      expect(other).toBeDefined();
      expect(equal(unit.when, other!.when)).toBe(true);
      expect(other!.exclusive_with).toContain(unit.id);
      expect(unit.zh.body).not.toEqual(other!.zh.body);
      expect(unit.en.body).not.toEqual(other!.en.body);
    }
  });

  it('selects one stable variant per user across locales without duplicating the indicator', () => {
    const found = audit.samples.find(({ chart }) =>
      audit.knowledge.units.some(
        (u) => u.id.startsWith('qimen.use_gods.') && evaluateWhen(chart, u.when).matched,
      ),
    )!;
    const selections = new Set<string>();
    for (const userId of ['sample-1', 'sample-2', 'sample-3', 'sample-4']) {
      const input = {
        system: 'qimen' as const,
        chart: found.chart,
        knowledge: audit.knowledge,
        context: { now: '2026-10-04', profileHasTime: true, userId },
      };
      const zh = interpret({ ...input, locale: 'zh' });
      const en = interpret({ ...input, locale: 'en' });
      expect(zh.hits.map((h) => h.unitId)).toEqual(en.hits.map((h) => h.unitId));
      expect(interpret({ ...input, locale: 'zh' })).toEqual(zh);
      const variants = zh.hits.filter((h) => h.unitId.startsWith('qimen.use_gods.'));
      expect(new Set(variants.map((h) => h.unitId.slice(0, -2))).size).toBe(variants.length);
      selections.add(variants.map((h) => h.unitId).join(','));
    }
    expect(selections.size).toBeGreaterThan(1);
  });

  it('preserves duplicate-warning scores when reusing corpus fingerprints', () => {
    const a = audit.knowledge.units[0]!.en.body;
    const b = audit.knowledge.units[1]!.en.body;
    expect(trigramSimilarity(trigrams(a), trigrams(b))).toBe(similarity(a, b));
    expect(trigramSimilarity(trigrams(a), trigrams(a))).toBe(1);
  });
});
