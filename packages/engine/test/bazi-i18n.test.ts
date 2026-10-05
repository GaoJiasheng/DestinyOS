import {
  Branch as BranchEnum,
  Element,
  LifeStage,
  NaYin,
  PatternKeySchema,
  ShenShaNameSchema,
  SolarTerm,
  Stem as StemEnum,
  TenGod,
} from '@tianji/shared';
import { describe, expect, it } from 'vitest';
import en from '../../../apps/web/messages/en.json';
import zh from '../../../apps/web/messages/zh.json';
import { checkCatalogs } from '../../../scripts/i18n-validation';
import { baziWarnings, normalizeBirth } from '../src';
import { fixtures, sample } from './bazi-fixtures';
import E from './fixtures/bazi/E.json';

describe('next-intl bilingual keys', () => {
  it('provides next-intl catalogs for all output names and emitted rationale/warning keys', () => {
    const keys: string[] = [];
    for (const [group, values] of Object.entries({
      stems: StemEnum,
      branches: BranchEnum,
      elements: Element,
      tenGods: TenGod,
      naYin: NaYin,
      lifeStages: LifeStage,
      solarTerms: SolarTerm,
    }))
      keys.push(...Object.values(values).map((v) => `bazi.${group}.${v}`));
    keys.push(
      ...PatternKeySchema.options.map((v) => `bazi.patterns.${v}`),
      ...ShenShaNameSchema.options.map((v) => `bazi.shenSha.${v}`),
    );
    for (const f of fixtures) keys.push(...f.chart.useGod.rationale, ...f.chart.pattern.notes);
    const weak = sample([
      ['geng', 'shen'],
      ['geng', 'shen'],
      ['jia', 'wu'],
      ['geng', 'shen'],
    ]);
    keys.push(
      ...weak.pattern.notes,
      ...baziWarnings(normalizeBirth(E.input), weak).map((w) => w.messageKey),
    );
    expect(
      baziWarnings(normalizeBirth(E.input), weak).some((w) => w.code === 'W_SUSPECTED_CONG'),
    ).toBe(true);
    expect(checkCatalogs(zh, en)).toEqual([]);
    for (const messages of [zh, en])
      for (const key of keys) expect((messages as Record<string, string>)[key]).toBeTruthy();
  });
});
