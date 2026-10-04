import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { stringify } from 'yaml';
import { units, baziChart } from '../../interpret/test/fixtures/knowledge';
import {
  validateSource,
  validateRelations,
  checkCoverage,
  validateGlossary,
  validateTransitions,
} from '../scripts/validation';
import { loadContent } from '../scripts/load';
import type { KnowledgeUnit } from '../src';
const file = 'fixtures/invalid-ku.yaml';
const fixtures = { bazi: [baziChart] };
function sample(): KnowledgeUnit {
  const unit = units[0];
  if (!unit) throw new Error('Missing handwritten sample');
  return structuredClone(unit);
}
function diagnose(unit: KnowledgeUnit) {
  return validateSource(file, stringify([unit]), fixtures);
}
describe('knowledge validation', () => {
  it('accepts the thirty bilingual handwritten units and fixture paths', () => {
    expect(units).toHaveLength(30);
    const result = validateSource('fixtures/bazi.yaml', stringify(units), fixtures);
    expect(result.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
    expect(validateRelations(result.units).filter((d) => d.severity === 'error')).toEqual([]);
  });
  it('loads the source disclaimer, glossary and bilingual transitions', async () => {
    const result = await loadContent();
    // §7 treats editorial similarity as a review warning, not a schema failure.
    expect(result.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
    expect(result.glossary.length).toBeGreaterThan(400);
    expect(result.units.map((u) => u.id)).toContain('common.disclaimer');
  });
  it('locates an invalid when.path in the original file and line', () => {
    const unit = sample();
    unit.when = { path: 'dayMaster.typo', eq: 'geng' };
    const source = stringify([unit]);
    const errors = validateSource(file, source, fixtures).diagnostics;
    const issue = errors.find((d) => d.message.includes('dayMaster.typo'));
    expect(issue?.file).toBe(file);
    expect(issue?.line).toBe(
      source.split('\n').findIndex((line) => line.includes('path: dayMaster.typo')) + 1,
    );
    expect(issue?.severity).toBe('error');
  });
  it('rejects missing English, invalid weights and ambiguous operators', () => {
    const unit = sample();
    const missing = { ...unit, en: undefined };
    expect(
      validateSource(file, stringify([missing]), fixtures).diagnostics.some((d) =>
        d.message.includes('en'),
      ),
    ).toBe(true);
    unit.weight = 101;
    expect(diagnose(unit).diagnostics.some((d) => d.message.includes('weight'))).toBe(true);
    expect(
      validateSource(
        file,
        stringify([{ ...sample(), when: { path: 'dayMaster.stem', eq: 'geng', exists: true } }]),
        fixtures,
      ).diagnostics.length,
    ).toBeGreaterThan(0);
  });
  it('enforces bilingual length, suggestion, buffer and forbidden language checks', () => {
    const unit = sample();
    unit.zh.body = '短';
    unit.en.summary = Array(40).fill('word').join(' ');
    expect(diagnose(unit).diagnostics.some((d) => d.message.includes('body length'))).toBe(true);
    expect(diagnose(unit).diagnostics.some((d) => d.message.includes('summary too long'))).toBe(
      true,
    );
    const bad = sample();
    bad.zh.title = '注定成功';
    bad.en.title = 'Guaranteed success';
    expect(
      diagnose(bad).diagnostics.filter((d) => d.message.includes('Banned phrase')),
    ).toHaveLength(2);
    bad.en.title = 'A guaranteed outcome';
    bad.polarity = 'negative';
    bad.en.body = 'A simple observation. '.repeat(45);
    expect(diagnose(bad).diagnostics.some((d) => d.message.includes('buffering'))).toBe(true);
    expect(diagnose(bad).diagnostics.some((d) => d.message.includes('actionable'))).toBe(true);
  });
  it('checks reciprocal exclusions, duplicate ids and emits 3-gram warnings', () => {
    const a = sample(),
      b = sample();
    b.id = 'bazi.overview.clone';
    a.exclusive_with = [b.id];
    const result = validateSource(file, stringify([a, b]), fixtures);
    expect(validateRelations(result.units).some((d) => d.message.includes('nonreciprocal'))).toBe(
      true,
    );
    expect(
      validateRelations(result.units).some(
        (d) => d.severity === 'warning' && d.message.includes('3-grams'),
      ),
    ).toBe(true);
    b.exclusive_with = [a.id];
    expect(
      validateRelations(validateSource(file, stringify([a, b]), fixtures).units).filter(
        (d) => d.severity === 'error',
      ),
    ).toEqual([]);
    expect(
      validateRelations(validateSource(file, stringify([a, a]), fixtures).units).some((d) =>
        d.message.includes('Duplicate'),
      ),
    ).toBe(true);
  });
  it('rejects invalid YAML and bilingual auxiliary data', () => {
    expect(validateSource(file, '- id: [\n', fixtures).diagnostics[0]?.file).toBe(file);
    expect(
      validateGlossary('glossary.yaml', '- key: sample\n  zh: {term: test}\n').diagnostics.length,
    ).toBeGreaterThan(0);
    expect(validateTransitions('transitions.yaml', 'zh: {}\n').diagnostics.length).toBeGreaterThan(
      0,
    );
  });
  it('detects section coverage holes without treating draft units as coverage', () => {
    expect(checkCoverage(units, [baziChart], ['overview', 'day_master'])).toEqual([]);
    expect(checkCoverage(units, [baziChart], ['missing'])[0]).toContain('missing: 1/1');
    const draft = sample();
    draft.meta.status = 'draft';
    expect(checkCoverage([draft], [baziChart], ['overview'])).toHaveLength(1);
  });
  it('keeps the schema available as a standalone JSON Schema', async () => {
    const schema: unknown = JSON.parse(
      await readFile(new URL('../schema/ku.schema.json', import.meta.url), 'utf8'),
    );
    expect(schema).toHaveProperty('$defs.when.oneOf');
  });
});

// Corpus comparisons must retain the documented Dice score while reusing tokenization.
describe('cached duplicate comparison', () => {
  it('preserves exhaustive Set-based warning decisions with packed corpus intersections', async () => {
    const { similarity } = await import('../src');
    const texts = [
      '甲乙丙丁木火土金水。你可以比较实际经验，再调整一项生活安排。',
      '甲乙丙丁木火土金水。你可以比较实际经历，再调整一项生活安排。',
      'Try comparing the actual experience before adjusting one part of a routine.',
      'Try comparing the actual response before adjusting one part of a routine.',
      'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789',
      '不同的观察提供不同的问题，允许根据真实反馈修改选择。',
      '',
      '甲',
      'ab',
    ];
    const located = texts.map((text, index) => ({
      file: 'packed-test.yaml',
      locate: () => ({ line: 1, column: 1 }),
      unit: {
        ...sample(),
        id: `bazi.packed.u${index}`,
        exclusive_with: [],
        zh: { ...sample().zh, body: text },
        en: { ...sample().en, body: texts[texts.length - index - 1]! },
      },
    }));
    const expected: string[] = [];
    for (let i = 0; i < located.length; i++)
      for (const b of located.slice(i + 1))
        for (const locale of ['zh', 'en'] as const) {
          const a = located[i]!.unit;
          if (similarity(a[locale].body, b.unit[locale].body) > 0.6)
            expected.push(`Similar 3-grams: ${a.id} / ${b.unit.id} (${locale})`);
        }
    expect(
      validateRelations(located)
        .filter((d) => d.severity === 'warning')
        .map((d) => d.message),
    ).toEqual(expected);
  });
  it('matches the direct comparator for repeated bilingual and short inputs', async () => {
    const { createSimilarityComparator, similarity } = await import('../src');
    const cached = createSimilarityComparator();
    const texts = [
      '',
      '甲',
      '你可以先列出任务，再确定负责人。',
      '你可以先列出安排，再确定检查点。',
      'Try assigning a clear owner before starting.',
      'Keep the invitation easy to decline.',
    ];
    for (const a of texts)
      for (const b of texts) {
        expect(cached(a, b)).toBe(similarity(a, b));
        expect(cached(a, b)).toBe(similarity(a, b));
      }
  });
});
