import { readFile } from 'node:fs/promises';
import { beforeAll, describe, expect, it } from 'vitest';
import { Aspect, Planet, Sign, AstroChartSchema } from '@tianji/shared';
import { auditAstrology } from '../scripts/astrology-coverage';
import { conditions, equal, evaluateWhen, resolvePath } from '../src';
import { interpret } from '../../interpret/src';

let audit: Awaited<ReturnType<typeof auditAstrology>>;
// DESIGN-GAP: Preserve the full fifty-chart audit under coverage on shared hosts with the suite's two-minute budget.
beforeAll(async () => {
  audit = await auditAstrology(50);
}, 120_000);

describe('astrology editorial knowledge', () => {
  it('exhausts every documented dimension rather than just meeting a total count', () => {
    const ids = new Set(audit.knowledge.units.map((u) => u.id));
    for (const planet of Object.values(Planet)) {
      for (const sign of Object.values(Sign)) {
        const root = `astrology.planet_sign.${planet}.${sign}`;
        if (planet === 'sun' || planet === 'moon') {
          expect(ids.has(root + '.a')).toBe(true);
          expect(ids.has(root + '.b')).toBe(true);
        } else expect(ids.has(root)).toBe(true);
      }
      for (let house = 1; house <= 12; house++)
        expect(ids.has(`astrology.planet_house.${planet}.h${house}`)).toBe(true);
    }
    for (const sign of Object.values(Sign)) {
      for (const variant of ['a', 'b'])
        expect(ids.has(`astrology.ascendant.${sign}.${variant}`)).toBe(true);
      for (let house = 1; house <= 12; house++)
        expect(ids.has(`astrology.cusp.h${house}.${sign}`)).toBe(true);
    }
    const planets = Object.values(Planet).slice(0, 10);
    for (const [index, a] of planets.entries())
      for (const b of planets.slice(index + 1))
        for (const type of Object.values(Aspect).slice(0, 5))
          expect(ids.has(`astrology.aspect.${a}_${b}.${type}`)).toBe(true);
    const count = (prefix: string) =>
      [...ids].filter((id) => id.startsWith(`astrology.${prefix}.`)).length;
    expect(count('pattern')).toBe(6);
    expect(count('stat')).toBe(14);
    expect(count('moon_phase')).toBe(8);
    expect(count('fallback')).toBe(9);
    expect(audit.statistics.units).toBe(809);
  });

  it('uses only paths resolvable on genuine engine results and preserves A–G fixture provenance', async () => {
    for (const unit of audit.knowledge.units.filter((u) => u.system === 'astrology'))
      for (const condition of conditions(unit.when)) {
        expect(condition.path.startsWith('features.')).toBe(false);
        expect(condition.path.startsWith('transits')).toBe(false);
        expect(
          audit.samples.some(({ chart }) => resolvePath(chart, condition.path, true).length > 0),
        ).toBe(true);
      }
    for (const sample of audit.samples.slice(0, 7)) {
      const frozen = AstroChartSchema.parse(
        JSON.parse(
          await readFile(
            new URL(`./fixtures/astrology.${sample.fixture}.json`, import.meta.url),
            'utf8',
          ),
        ) as unknown,
      );
      expect(sample.chart).toEqual(frozen);
    }
  });

  it('matches each of the 225 aspect conditions in either endpoint order, without mixing records', () => {
    const units = audit.knowledge.units.filter((u) => u.id.startsWith('astrology.aspect.'));
    for (const unit of units) {
      const parts = unit.id.split('.');
      const pair = parts[2]!.split('_');
      const type = parts[3]!;
      const a = pair[0]!,
        b = pair[1]!;
      const edge = { a, b, type, major: true };
      expect(evaluateWhen({ aspects: [edge] }, unit.when).matched).toBe(true);
      expect(evaluateWhen({ aspects: [{ ...edge, a: b, b: a }] }, unit.when).matched).toBe(true);
      expect(evaluateWhen({ aspects: [{ ...edge, major: false }] }, unit.when).matched).toBe(false);
      const other = type === 'square' ? 'trine' : 'square';
      expect(
        evaluateWhen(
          {
            aspects: [
              { ...edge, type: other },
              { ...edge, a: 'north_node', type },
            ],
          },
          unit.when,
        ).matched,
      ).toBe(false);
    }
  });

  it('provides original paired variants with equal predicates and reciprocal exclusions', () => {
    const units = audit.knowledge.units.filter((u) => /\.[ab]$/.test(u.id));
    expect(units).toHaveLength(72);
    for (const unit of units) {
      const other = units.find((u) => u.id === unit.exclusive_with[0])!;
      expect(other).toBeDefined();
      expect(other.exclusive_with).toContain(unit.id);
      expect(equal(unit.when, other.when)).toBe(true);
      expect(unit.zh.body).not.toEqual(other.zh.body);
      expect(unit.en.body).not.toEqual(other.en.body);
    }
    const chart = audit.samples[0]!.chart;
    const run = (locale: 'zh' | 'en') =>
      interpret({
        system: 'astrology',
        chart,
        locale,
        knowledge: audit.knowledge,
        context: {
          now: '2026-10-05T00:00:00Z',
          profileHasTime: true,
          userId: 'editorial-variant-test',
        },
      });
    const zh = run('zh');
    expect(zh).toEqual(run('zh'));
    expect(zh.hits.map((h) => h.unitId)).toEqual(run('en').hits.map((h) => h.unitId));
    for (const prefix of ['planet_sign.sun', 'planet_sign.moon', 'ascendant'])
      expect(zh.hits.filter((h) => h.unitId.startsWith(`astrology.${prefix}.`))).toHaveLength(1);
  });

  it('produces nine readable bilingual chapters for A–G, fifty random births and all boundaries', () => {
    expect(audit.statistics.failures).toEqual([]);
    expect(audit.statistics.readabilityIssues).toEqual([]);
    expect(Object.values(audit.statistics.chapterEmptyRates)).toEqual(Array(9).fill(0));
    expect(audit.statistics.reportLengths.zh?.min).toBeGreaterThanOrEqual(2500);
    expect(audit.statistics.reportLengths.en?.min).toBeGreaterThanOrEqual(1800);
    expect(audit.statistics.selectedVariants).toBeGreaterThan(36);
  });

  it('retains every chapter with weak fallbacks alone and does not infer houses without time', () => {
    const chart = audit.samples.find((s) => s.chart.noonChart)!.chart;
    const knowledge = {
      ...audit.knowledge,
      units: audit.knowledge.units.filter(
        (u) => u.id.startsWith('astrology.fallback.') || u.system === 'common',
      ),
    };
    for (const locale of ['zh', 'en'] as const) {
      const report = interpret({
        system: 'astrology',
        chart,
        locale,
        knowledge,
        context: { now: '2026-10-05T00:00:00Z', profileHasTime: false },
      });
      expect(report.hits).toHaveLength(9);
      expect(report.readability.passed).toBe(true);
      expect(
        report.sections.every((s) => s.lead && s.blocks.some((b) => b.type === 'paragraph')),
      ).toBe(true);
    }
    for (const unit of audit.knowledge.units.filter((u) =>
      /astrology\.(ascendant|cusp|planet_house)\./.test(u.id),
    ))
      expect(evaluateWhen(chart, unit.when).matched).toBe(false);
  });
});
