import { beforeAll, expect, it } from 'vitest';
import { computeNumerology, normalizeBirth, createRandom } from '@tianji/engine';
import { loadContent } from '../../content/scripts/load';
import { evaluateWhen, type KnowledgeBundle } from '@tianji/content';
import { interpret, systemConfigs } from '../src';
let knowledge: KnowledgeBundle;
beforeAll(async () => {
  const loaded = await loadContent();
  expect(loaded.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
  knowledge = {
    knowledgeVersion: '1.6.0',
    units: loaded.units.filter((u) => u.system === 'numerology' || u.system === 'common'),
    glossary: loaded.glossary,
    transitions: loaded.transitions!,
  };
});
it('provides 125 bilingual KUs and readable reports in all chapters across 500 valid dates', () => {
  expect(knowledge.units.filter((u) => u.system === 'numerology')).toHaveLength(125);
  const random = createRandom('numerology-coverage-v1');
  for (let i = 0; i < 500; i++) {
    const birth = normalizeBirth({
      calendar: 'gregorian',
      year: 1900 + Math.floor(random.next() * 126),
      month: 1 + Math.floor(random.next() * 12),
      day: 1 + Math.floor(random.next() * 28),
      timeUnknown: true,
      gender: 'unspecified',
    });
    const chart = computeNumerology({
      birth,
      name: i % 2 ? 'John Doe' : undefined,
      date: '2026-10-05',
    });
    for (const spec of systemConfigs.numerology.sectionPlan)
      expect(
        knowledge.units.some(
          (u) =>
            u.section === spec.key &&
            u.system === 'numerology' &&
            evaluateWhen(chart, u.when).matched,
        ),
        `${i} ${spec.key}`,
      ).toBe(true);
    for (const locale of ['zh', 'en'] as const) {
      const report = interpret({
        system: 'numerology',
        chart,
        locale,
        knowledge,
        context: { now: '2026-10-05T00:00:00Z', profileHasTime: false },
      });
      expect(
        report.readability.passed,
        `${i} ${locale} ${JSON.stringify(report.readability)}`,
      ).toBe(true);
      expect(report.headline.confidence).toBe(1);
      expect(
        report.sections.every((s) => s.lead && s.blocks.some((b) => b.type === 'paragraph')),
      ).toBe(true);
      if (chart.nameNumbers)
        expect(report.hits.some((h) => h.unitId === 'numerology.name_missing')).toBe(false);
    }
  }
});
