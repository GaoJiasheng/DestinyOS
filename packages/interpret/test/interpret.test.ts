import { beforeAll, describe, expect, it } from 'vitest';
import { loadContent } from '../../content/scripts/load';
import { deduplicate } from '@tianji/content';
import type { KnowledgeBundle, KnowledgeUnit } from '@tianji/content';
import { interpret, systemConfigs, checkReadability, termMarker } from '../src';
import type { InterpretInput, Report } from '../src';
import { units, baziChart, bundle } from './fixtures/knowledge';
let knowledge: KnowledgeBundle;
beforeAll(async () => {
  const loaded = await loadContent();
  if (!loaded.transitions) throw new Error('Invalid transitions');
  knowledge = bundle({
    knowledgeVersion: '1.0.0',
    units: loaded.units,
    glossary: loaded.glossary,
    transitions: loaded.transitions,
  });
});
function input(locale: 'zh' | 'en' = 'zh'): InterpretInput {
  return {
    system: 'bazi',
    chart: baziChart,
    locale,
    knowledge,
    context: { now: '2026-10-04T00:00:00Z', profileHasTime: true, engineVersion: 'test-1.0.0' },
  };
}
function texts(report: Report) {
  return report.sections
    .flatMap((s) => [
      s.lead,
      ...s.blocks.flatMap((b) =>
        b.type === 'paragraph' || b.type === 'transition' ? [b.text] : [],
      ),
    ])
    .join('\n');
}
function copyUnit(id: string): KnowledgeUnit {
  const value = units.find((u) => u.id === id);
  if (!value) throw new Error(`Missing fixture ${id}`);
  return structuredClone(value);
}
describe('deterministic interpretation', () => {
  it.each(['zh', 'en'] as const)('composes a complete ordered %s report with 30 KUs', (locale) => {
    const report = interpret(input(locale));
    expect(report.sections.map((s) => s.key)).toEqual(
      systemConfigs.bazi.sectionPlan.map((s) => s.key),
    );
    expect(report.sections.every((s) => s.blocks.length > 0)).toBe(true);
    expect(report.hits.map((h) => h.unitId)).toContain('bazi.nature.precise');
    expect(report.hits.map((h) => h.unitId)).not.toContain('bazi.nature.competitor');
    const section = report.sections.find((s) => s.key === 'day_master');
    const lower = section?.blocks.find(
      (b) => b.type === 'paragraph' && b.unitId === 'bazi.nature.rigid',
    );
    expect(lower?.type === 'paragraph' ? lower.text : '').toBe(
      copyUnit('bazi.nature.rigid')[locale].summary,
    );
    expect(
      section?.blocks.some(
        (b) => b.type === 'transition' && knowledge.transitions[locale].concession.includes(b.text),
      ),
    ).toBe(true);
    expect(texts(report)).toContain('[[term:day_master]]');
    expect(texts(report).match(/\[\[term:day_master\]\]/g)).toHaveLength(1);
    expect(report.sections.flatMap((s) => s.blocks).some((b) => b.type === 'sources')).toBe(true);
    expect(report.headline.scores).toEqual({ career: 5, wealth: 3, love: 3, health: 3, social: 1 });
    expect(report.headline.keywords).toHaveLength(3);
    expect(report.headline.keywords).not.toContain('career');
    expect(report.engineVersion).toBe('test-1.0.0');
    expect(report.disclaimerKey).toBe('common.disclaimer');
    expect(report.readability.passed).toBe(true);
    const summary = report.sections.at(-1);
    expect(summary?.blocks.find((b) => b.type === 'advice')).toHaveProperty('items.length', 5);
    expect(
      summary?.blocks.some((b) => b.type === 'paragraph' && b.unitId === 'common.disclaimer'),
    ).toBe(true);
    expect(JSON.stringify(report)).toBe(JSON.stringify(interpret(input(locale))));
  });
  it('does not mutate inputs or depend on bundle order', () => {
    const value = input();
    const snapshot = JSON.stringify(value);
    const original = interpret(value);
    expect(JSON.stringify(value)).toBe(snapshot);
    expect(
      interpret({ ...value, knowledge: { ...knowledge, units: [...knowledge.units].reverse() } }),
    ).toEqual(original);
  });
  it('uses matched evidence and specificity plus system multipliers', () => {
    const report = interpret({ ...input(), config: { weightMultiplier: () => 2 } });
    const hit = report.hits.find((h) => h.unitId === 'bazi.nature.precise');
    expect(hit?.weight).toBe(186);
    expect(hit?.evidence).toEqual([
      { path: 'dayMaster.stem', value: 'geng' },
      { path: 'strength.level', value: 'strong' },
    ]);
    const evidence = report.sections
      .find((s) => s.key === 'day_master')
      ?.blocks.find((b) => b.type === 'evidence');
    expect(evidence?.type === 'evidence' ? evidence.items[0]?.anchor : '').toBe(
      'chart:dayMaster.stem',
    );
  });
  it('uses no repeated transition text within a section and obeys caps', () => {
    const extra = Array.from({ length: 8 }, (_, n) => ({
      ...copyUnit('bazi.overview.focus'),
      id: `bazi.overview.extra_${n}`,
      topic: `extra_${n}`,
      weight: 20 + n,
    }));
    const report = interpret({
      ...input(),
      knowledge: { ...knowledge, units: [...knowledge.units, ...extra] },
    });
    expect(report.hits.filter((h) => h.section === 'overview')).toHaveLength(3);
    for (const section of report.sections) {
      const transitions = section.blocks.flatMap((b) => (b.type === 'transition' ? [b.text] : []));
      expect(new Set(transitions).size).toBe(transitions.length);
    }
  });
  it('qualifies conclusions when confidence is low or birth time is missing', () => {
    const report = interpret({ ...input(), context: { now: '2026-10-04', profileHasTime: false } });
    expect(report.headline.confidence).toBe(0.65);
    expect(
      knowledge.transitions.zh.low_confidence.some((t) => report.sections[0]?.lead.startsWith(t)),
    ).toBe(true);
  });
  it('substitutes chart and glossary variables while surfacing unresolved placeholders', () => {
    const unit = copyUnit('bazi.overview.focus');
    unit.variables = { color: '{{glossary.element.wood.colors}}' };
    unit.zh.body += '你可以试试{{color}}，{{chart.strength.score}}，{{unknown.variable}}。';
    const report = interpret({
      ...input(),
      knowledge: {
        ...knowledge,
        units: [unit, ...knowledge.units.filter((u) => u.system === 'common')],
      },
    });
    expect(texts(report)).toContain('绿色');
    expect(texts(report)).toContain('3.5');
    expect(report.readability.issues).toContain('report.readability.unresolvedVariables');
  });
  it('excludes draft/deprecated units and other systems', () => {
    const draft = copyUnit('bazi.overview.focus');
    draft.meta.status = 'draft';
    const deprecated = copyUnit('bazi.elements.wood');
    deprecated.meta.status = 'deprecated';
    const other = copyUnit('bazi.wealth.boundary');
    other.system = 'tarot';
    expect(
      interpret({
        ...input(),
        knowledge: {
          ...knowledge,
          units: [
            draft,
            deprecated,
            other,
            ...knowledge.units.filter((u) => u.system === 'common'),
          ],
        },
      }).hits,
    ).toEqual([]);
  });
  it('handles empty chapters and appends shared divination summary', () => {
    const report = interpret({ ...input(), system: 'tarot' });
    expect(report.sections.map((s) => s.key)).toEqual([
      ...systemConfigs.tarot.sectionPlan.map((s) => s.key),
      'summary_actions',
    ]);
    expect(report.hits).toEqual([]);
    expect(report.readability.passed).toBe(false);
  });
  it('rejects invalid plans, missing disclaimers and invalid multiplier hooks', () => {
    expect(() =>
      interpret({
        ...input(),
        sectionPlan: [{ key: 'overview', title: { zh: '概览', en: 'Overview' }, maxUnits: 4 }],
      }),
    ).toThrow('sectionPlan');
    expect(() => interpret({ ...input(), knowledge: { ...knowledge, units } })).toThrow(
      'common.disclaimer',
    );
    expect(() => interpret({ ...input(), config: { weightMultiplier: () => Number.NaN } })).toThrow(
      'multiplier',
    );
  });
  it('uses 3-gram similarity to remove duplicate advice', () => {
    expect(
      deduplicate(
        ['Keep a steady routine.', 'Keep a steady routine!', 'Listen to another view.'],
        3,
      ),
    ).toEqual(['Keep a steady routine.', 'Listen to another view.']);
  });
  it('checks minimum size, terminology density and unresolved variables', () => {
    const report = interpret(input());
    expect(
      checkReadability(
        {
          ...report,
          sections: [
            {
              key: 'overview',
              title: '',
              lead: '日主 '.repeat(100) + '{{unresolved}}',
              blocks: [],
            },
          ],
        },
        knowledge.glossary,
      ).issues,
    ).toEqual([
      'report.readability.tooShort',
      'report.readability.termDense',
      'report.readability.unresolvedVariables',
    ]);
  });
  it('uses longest matches, aliases and word boundaries for glossary marks', () => {
    const mark = termMarker(knowledge.glossary, 'zh');
    expect(mark('日元 日主')).toBe('[[term:day_master]] 日主');
    const english = termMarker(knowledge.glossary, 'en');
    expect(english('Hollywood Wood')).toBe('Hollywood [[term:element.wood]]');
  });
  it('preserves Markdown links containing glossary aliases and marks later prose normally', () => {
    const mark = termMarker(knowledge.glossary, 'en');
    expect(mark('[Wood](/en/learn/Wood) Wood')).toBe(
      '[Wood](/en/learn/Wood) [[term:element.wood]]',
    );
  });
});
