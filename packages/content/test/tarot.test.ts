import { beforeAll, describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import { parse, stringify } from 'yaml';
import { TAROT_SPREADS, CategorySchema } from '../../shared/src';
import { interpret } from '../../interpret/src';
import { conditions, equal, evaluateWhen, resolvePath } from '../src';
import { auditTarot } from '../scripts/check-tarot-coverage';
import { validateAsset } from '../scripts/assets';

let audit: Awaited<ReturnType<typeof auditTarot>>;
// DESIGN-GAP: Preserve the full fifty-chart audit under coverage on shared hosts with the suite's two-minute budget.
beforeAll(async () => {
  audit = await auditTarot(50);
}, 120_000);

describe('published tarot editorial knowledge', () => {
  it('covers every schema position, six categories, thirty pairs and every report chapter', () => {
    const units = audit.knowledge.units.filter((u) => u.system === 'tarot');
    expect(units).toHaveLength(124);
    for (const [spread, positions] of Object.entries(TAROT_SPREADS))
      for (const position of positions)
        expect(
          units.some((u) => u.id.startsWith(`tarot.positions.${spread}.${position.key}`)),
        ).toBe(true);
    for (const category of CategorySchema.options)
      expect(units.some((u) => u.id === `tarot.category.${category}`)).toBe(true);
    expect(units.filter((u) => u.id.startsWith('tarot.combination.'))).toHaveLength(30);
    expect(units.filter((u) => u.id.startsWith('tarot.fallback.'))).toHaveLength(6);
    expect(units.filter((u) => u.id.startsWith('tarot.learn.'))).toHaveLength(8);
  });

  it('resolves all conditions on legal engine output and provides real witnesses for every pair', () => {
    for (const unit of audit.knowledge.units.filter((u) => u.system === 'tarot'))
      for (const condition of conditions(unit.when)) {
        expect(condition.path.startsWith('features.')).toBe(false);
        expect(
          audit.samples.some(({ chart }) => resolvePath(chart, condition.path, true).length > 0),
        ).toBe(true);
      }
    expect(audit.witnesses.size).toBe(30);
    for (const [key, chart] of audit.witnesses) {
      const unit = audit.knowledge.units.find((u) => u.id === `tarot.combination.${key}`)!;
      expect(evaluateWhen(chart, unit.when).matched).toBe(true);
      expect(
        evaluateWhen({ ...chart, combos: chart.combos.filter((c) => c !== key) }, unit.when)
          .matched,
      ).toBe(false);
    }
  });

  it('assembles complete bilingual readings for A–G and fifty legal random samples', () => {
    expect(audit.coverageErrors).toEqual([]);
    expect(Object.values(audit.statistics.emptySections)).toEqual([0, 0, 0, 0, 0, 0]);
    expect(audit.statistics.readabilityIssues).toEqual({});
    expect(audit.statistics.spreadCategoryCombinations).toBe(48);
    expect(audit.statistics.zhChars.min).toBeGreaterThanOrEqual(1200);
    expect(audit.statistics.enWords.min).toBeGreaterThanOrEqual(900);
  });

  it('keeps all six chapters readable using only weak fallbacks', () => {
    const knowledge = {
      ...audit.knowledge,
      units: audit.knowledge.units.filter(
        (u) => u.system === 'common' || u.id.startsWith('tarot.fallback.'),
      ),
    };
    for (const locale of ['zh', 'en'] as const) {
      const report = interpret({
        system: 'tarot',
        chart: audit.samples[0]!.chart,
        locale,
        knowledge,
        context: { now: '2026-10-05', profileHasTime: true },
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

  it('selects exactly one stable single-card variant per user across both locales', () => {
    for (const spread of ['single', 'yes_no']) {
      const chart = audit.samples.find((s) => s.chart.spread === spread)!.chart;
      const root =
        spread === 'single' ? 'tarot.positions.single.focus' : 'tarot.positions.yes_no.answer';
      const variants = audit.knowledge.units.filter((u) => u.id.startsWith(root));
      expect(variants).toHaveLength(2);
      expect(equal(variants[0]!.when, variants[1]!.when)).toBe(true);
      expect(variants[0]!.exclusive_with).toContain(variants[1]!.id);
      expect(variants[1]!.exclusive_with).toContain(variants[0]!.id);
      const selections = new Set<string>();
      for (const userId of ['user-1', 'user-2', 'user-3', 'user-4']) {
        const input = {
          system: 'tarot' as const,
          chart,
          knowledge: audit.knowledge,
          context: { now: '2026-10-05', profileHasTime: true, userId },
        };
        const zh = interpret({ ...input, locale: 'zh' });
        const en = interpret({ ...input, locale: 'en' });
        expect(zh.hits.map((h) => h.unitId)).toEqual(en.hits.map((h) => h.unitId));
        expect(interpret({ ...input, locale: 'zh' })).toEqual(zh);
        const chosen = zh.hits.filter((h) => h.unitId.startsWith(root));
        expect(chosen).toHaveLength(1);
        selections.add(chosen[0]!.unitId);
      }
      expect(selections.size).toBe(2);
    }
  });

  it('links every actual drawn card in both locales, including all thirteen annual positions', () => {
    for (const spread of Object.keys(TAROT_SPREADS)) {
      const chart = audit.samples.find((s) => s.chart.spread === spread)!.chart;
      for (const locale of ['zh', 'en'] as const) {
        const report = interpret({
          system: 'tarot',
          chart,
          locale,
          knowledge: audit.knowledge,
          context: { now: '2026-10-05', profileHasTime: true },
        });
        const text = report.sections
          .find((s) => s.key === 'learn')!
          .blocks.flatMap((b) => (b.type === 'paragraph' ? [b.text] : []))
          .join('\n');
        expect(text).not.toContain('{{');
        for (const card of chart.cards)
          expect(text).toContain(`/${locale}/learn/tarot/${card.cardKey}`);
      }
    }
  });

  it('rejects empty prose, invalid editorial lengths and prohibited language in all asset categories', async () => {
    const source = await readFile(new URL('../tarot/cards.yaml', import.meta.url), 'utf8');
    const cards = parse(source) as Array<{
      meaningUpright: { zh: string; en: string };
      advice: { zh: string; en: string };
      byCategory: { love: { reversed: { zh: string; en: string } } };
    }>;
    expect(validateAsset('tarot/cards.yaml', 'cards.yaml', source)).toEqual([]);
    cards[0]!.meaningUpright.zh = '过短';
    cards[1]!.advice.en = 'A guaranteed result';
    cards[2]!.byCategory.love.reversed.en = '   ';
    const errors = validateAsset('tarot/cards.yaml', 'cards.yaml', stringify(cards))!;
    expect(errors.some((e) => e.message.includes('Editorial length'))).toBe(true);
    expect(errors.some((e) => e.message.includes('Banned editorial phrase'))).toBe(true);
    expect(errors.some((e) => e.message.includes('Empty tarot editorial prose'))).toBe(true);
    expect(errors.every((e) => e.line > 0 && e.column > 0)).toBe(true);
  });
});
