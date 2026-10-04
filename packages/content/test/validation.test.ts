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
    expect(result.diagnostics).toEqual([]);
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
