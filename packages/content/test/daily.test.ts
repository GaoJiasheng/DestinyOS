import { beforeAll, describe, expect, it } from 'vitest';
import { DailyChartSchema, TenGod } from '@tianji/shared';
import { interpret } from '../../interpret/src';
import {
  evaluateWhen,
  resolvePath,
  type KnowledgeBundle,
  type KnowledgeUnit,
  type GlossaryEntry,
  type When,
} from '../src';
import { loadContent } from '../scripts/load';
import version from '../version.json';
import fixture from './fixtures/daily.a.json';
import plan from '../../interpret/src/plans/daily.json';

let knowledge: KnowledgeBundle;
let units: KnowledgeUnit[];
let glossary: GlossaryEntry[];
beforeAll(async () => {
  const result = await loadContent();
  expect(result.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
  if (!result.transitions) throw new Error('Missing transitions');
  knowledge = {
    ...version,
    units: result.units.filter((u) => u.system === 'daily' || u.system === 'common'),
    glossary: result.glossary.filter((g) => g.system === 'daily' || g.system === 'common'),
    transitions: result.transitions,
  };
  units = knowledge.units.filter((u) => u.system === 'daily');
  glossary = result.glossary;
}, 60_000);

const leaves = (when: When): string[] => {
  if ('all' in when) return when.all.flatMap(leaves);
  if ('any' in when) return when.any.flatMap(leaves);
  if ('not' in when) return leaves(when.not);
  return [when.path];
};

describe('daily editorial dimensions and report integration', () => {
  it('provides all 40 band/theme keys with two reciprocal stable variants', () => {
    const variants = units.filter((u) => u.id.startsWith('daily.oneliner.'));
    expect(variants).toHaveLength(80);
    const selected = new Set<string>();
    for (const band of ['great', 'good', 'mixed', 'careful']) {
      for (const theme of Object.values(TenGod)) {
        const key = `daily.oneliner.${band}.${theme}`;
        const pair = variants.filter((u) => u.id.startsWith(`${key}.`));
        expect(pair).toHaveLength(2);
        expect(pair[0]!.when).toEqual(pair[1]!.when);
        expect(pair[0]!.exclusive_with).toEqual([pair[1]!.id]);
        expect(pair[1]!.exclusive_with).toEqual([pair[0]!.id]);
        for (const locale of ['zh', 'en'] as const) {
          expect(pair[0]![locale].body).not.toBe(pair[1]![locale].body);
          for (const unit of pair) {
            // The short daily headline has its own tighter limit than the general KU summary.
            expect(
              locale === 'zh' ? [...unit.zh.summary].length : unit.en.summary.split(/\s+/).length,
            ).toBeLessThanOrEqual(locale === 'zh' ? 40 : 25);
          }
        }
        const chart = DailyChartSchema.parse({ ...fixture, oneLiner: key });
        for (let index = 0; index < 8; index++) {
          const input = {
            system: 'daily' as const,
            chart,
            locale: 'zh' as const,
            knowledge,
            context: { now: chart.date.local, profileHasTime: true, userId: `variant-${index}` },
          };
          const first = interpret(input);
          expect(interpret(input)).toEqual(first);
          const ids = first.hits.filter((h) => h.unitId.startsWith(`${key}.`)).map((h) => h.unitId);
          expect(ids).toHaveLength(1);
          const english = interpret({ ...input, locale: 'en' });
          expect(
            english.hits.filter((h) => h.unitId.startsWith(`${key}.`)).map((h) => h.unitId),
          ).toEqual(ids);
          ids.forEach((id) => selected.add(id));
        }
      }
    }
    expect(selected.size).toBe(80);
  }, 60_000);

  it('covers ten-god strengths, twelve Moon signs, eight phases and thirty exact transit keys', () => {
    for (const god of Object.values(TenGod)) {
      for (const strength of ['strong', 'balanced', 'weak']) {
        const finding = `bazi.tenGod.${god}.${strength}`;
        expect(
          units.filter((u) => evaluateWhen({ findings: [finding] }, u.when).matched).length,
        ).toBeGreaterThanOrEqual(2);
      }
    }
    expect(units.filter((u) => u.id.startsWith('daily.astro.moon_sign.'))).toHaveLength(12);
    expect(units.filter((u) => u.id.startsWith('daily.astro.moon_phase.'))).toHaveLength(8);
    const transits = units.filter((u) => u.id.startsWith('daily.astro.transit.'));
    expect(transits).toHaveLength(30);
    for (const unit of transits) {
      const finding = unit.id.replace('daily.', '');
      expect(evaluateWhen({ findings: [finding] }, unit.when).matched).toBe(true);
      expect(evaluateWhen({ findings: [finding + '_different'] }, unit.when).matched).toBe(false);
      expect(
        units.some(
          (u) =>
            ['career', 'wealth', 'love', 'health', 'social'].includes(u.section) &&
            evaluateWhen({ findings: [finding] }, u.when).matched,
        ),
      ).toBe(true);
    }
  });

  it('uses real schema paths and supplies readable nonempty chapters without optional evidence', () => {
    for (const unit of units)
      for (const path of leaves(unit.when)) {
        expect(path.startsWith('features.')).toBe(false);
        expect(resolvePath(fixture, path, true).length).toBeGreaterThan(0);
      }
    const chart = DailyChartSchema.parse({
      ...fixture,
      findings: [],
      vedic: undefined,
      astro: { ...fixture.astro, transits: [], retrogrades: [], moonIngress: undefined },
    });
    for (const spec of plan) {
      const fallback = units.find((u) => u.id === `daily.fallback.${spec.key}`);
      expect(fallback?.weight).toBe(1);
      expect(fallback && evaluateWhen(chart, fallback.when).matched).toBe(true);
    }
    for (const locale of ['zh', 'en'] as const) {
      const report = interpret({
        system: 'daily',
        chart,
        locale,
        knowledge,
        context: { now: chart.date.local, profileHasTime: false },
      });
      expect(report.sections.map((s) => s.key)).toEqual(plan.map((s) => s.key));
      expect(
        report.sections.every(
          (s) => s.lead && s.blocks.some((b) => b.type === 'paragraph' && b.text.trim()),
        ),
      ).toBe(true);
      expect(report.readability.passed).toBe(true);
      expect(report.disclaimerKey).toBe('common.disclaimer');
    }
  });

  it('keeps the primary Bazi direction and introduces a contrary transit with a concession', () => {
    const chart = DailyChartSchema.parse({
      ...fixture,
      findings: ['bazi.tenGod.qi_sha.strong', 'astro.transit.mars_square_sun'],
    });
    for (const locale of ['zh', 'en'] as const) {
      const report = interpret({
        system: 'daily',
        chart,
        locale,
        knowledge,
        context: { now: chart.date.local, profileHasTime: true },
      });
      const section = report.sections.find((s) => s.key === 'career');
      const paragraphs = section?.blocks.filter((b) => b.type === 'paragraph');
      expect(paragraphs?.[0]?.unitId).toBe('daily.career.ten_god.qi_sha.strong');
      expect(
        paragraphs?.find((b) => b.unitId === 'daily.career.transit.mars_square_sun')?.text,
      ).toBe(units.find((u) => u.id === 'daily.career.transit.mars_square_sun')![locale].summary);
      expect(
        section?.blocks.some(
          (b) =>
            b.type === 'transition' && knowledge.transitions[locale].concession.includes(b.text),
        ),
      ).toBe(true);
    }
  });

  it('publishes 600 explained bilingual glossary entries for all seven systems', () => {
    expect(glossary).toHaveLength(600);
    expect(new Set(glossary.map((g) => g.key)).size).toBe(600);
    for (const system of ['bazi', 'ziwei', 'iching', 'qimen', 'tarot', 'astrology', 'vedic'])
      expect(glossary.some((g) => g.system === system)).toBe(true);
    for (const entry of glossary)
      for (const locale of ['zh', 'en'] as const) {
        expect(entry[locale].pinyin?.trim()).toBeTruthy();
        expect(entry[locale].long.length).toBeGreaterThan(entry[locale].short.length);
      }
  });
});
