import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { computeZiwei, normalizeBirth } from '@tianji/engine';
import { BirthInputSchema, type ZiweiChart } from '@tianji/shared';
import type { CompiledScoringRules } from '@tianji/content';
import { ziweiScoringRules } from '@tianji/content/scoring/ziwei-rules';
import { ziweiScoringCopy } from '@tianji/content/scoring/ziwei-copy';
import { banned, positioningBanned } from '../../content/scripts/validation';
import {
  ZIWEI_LUCKY_STARS,
  ZIWEI_MALEFIC_STARS,
  evaluateEmphasis,
  ziweiEmphasis,
  ziweiScoringView,
  type ZiweiPalaceFacts,
} from '../src';
import {
  emphasisDimSentence,
  emphasisFootnotes,
  emphasisLevelLabel,
  emphasisOverview,
  renderEmphasisBasis,
} from '../src/emphasis';
const chartOf = (id: string): ZiweiChart =>
  computeZiwei({
    birth: normalizeBirth(
      BirthInputSchema.parse(
        JSON.parse(readFileSync(`packages/engine/test/fixtures/birth/${id}.json`, 'utf8')),
      ),
    ),
    now: '2026-11-16T00:00:00Z',
  });
const A = chartOf('A');
/** Compact golden form: "level raw rule±delta …" per dimension. */
function summary(chart: ZiweiChart) {
  const emphasis = ziweiEmphasis(chart);
  return {
    top: emphasis.top,
    ...Object.fromEntries(
      Object.entries(emphasis.dims).map(([dim, value]) => [
        dim,
        `${value.level} ${value.raw} ${value.basis
          .map((b) => `${b.ruleId.slice(3)}${b.delta >= 0 ? '+' : ''}${b.delta}`)
          .join(' ')}`,
      ]),
    ),
  };
}
const palace = (over: Partial<ZiweiPalaceFacts>): ZiweiPalaceFacts => ({
  palace: 'career',
  index: 8,
  branch: 'si',
  empty: false,
  majorStars: [],
  mutagens: [],
  lucky: [],
  malefic: [],
  luCun: false,
  tianMa: false,
  stars: [],
  brightnessOf: {},
  ...over,
});
describe('ziweiScoringView', () => {
  it('collects Fixture A target palaces and their opposites (§8.2)', () => {
    const view = ziweiScoringView(A, ziweiScoringRules.palaceOf);
    expect(Object.keys(view)).toEqual(['career', 'wealth', 'love', 'social']);
    expect(view.career?.self).toMatchObject({
      palace: 'career',
      branch: 'si',
      empty: false,
      majorStars: [{ key: 'ju_men', brightness: 'wang' }],
      malefic: ['huo_xing'],
      lucky: [],
    });
    expect(view.career?.opposite.palace).toBe('spouse');
    expect(view.career?.opposite.mutagens).toEqual([{ star: 'tai_yang', mutagen: 'lu' }]);
    expect(view.wealth?.self.mutagens).toEqual([{ star: 'tian_tong', mutagen: 'ji' }]);
    expect(view.wealth?.opposite).toMatchObject({ palace: 'wellbeing', malefic: ['di_jie'] });
    expect(view.social?.self.majorStars.map((s) => s.brightness)).toEqual(['ping', 'miao']);
    expect(view.social?.self.lucky).toEqual(['wen_chang']);
    expect(view.social?.opposite.palace).toBe('siblings');
  });
  it('addresses palaces by index, not array position, and reports 禄存/天马', () => {
    const shuffled = { ...A, palaces: [...A.palaces].reverse() };
    expect(ziweiScoringView(shuffled, ziweiScoringRules.palaceOf)).toEqual(
      ziweiScoringView(A, ziweiScoringRules.palaceOf),
    );
    const health = ziweiScoringView(A, { health: 'health' }).health?.self;
    expect(health).toMatchObject({ luCun: true, tianMa: true, lucky: ['wen_qu'] });
  });
  it('uses the same 六吉 / 六煞 sets as the reviewed rule table', () => {
    const keys = (id: string) => {
      const m = ziweiScoringRules.rules.find((r) => r.id === id)?.measure;
      return m?.kind === 'stars' ? m.keys : [];
    };
    expect(keys('zw.z4.lucky')).toEqual([...ZIWEI_LUCKY_STARS]);
    expect(keys('zw.z6.malefic')).toEqual([...ZIWEI_MALEFIC_STARS]);
  });
});
describe('evaluateEmphasis', () => {
  it('reproduces the Fixture A hand calculation of proposal §8.3 with the new cutpoints', () => {
    const emphasis = ziweiEmphasis(A);
    expect(emphasis.version).toBe('1.0.0');
    expect(emphasis.omitted).toEqual(['health']);
    expect(emphasis.dims.health).toBeUndefined();
    expect(
      Object.fromEntries(Object.entries(emphasis.dims).map(([d, v]) => [d, [v.raw, v.level]])),
    ).toEqual({ career: [1.25, 4], wealth: [-1, 2], love: [0, 3], social: [0.75, 4] });
    expect(emphasis.top).toEqual(['career', 'social']);
    // Z1 on flat ground still explains the dimension (§8.3 wealth).
    expect(emphasis.dims.wealth?.basis[0]).toEqual({
      ruleId: 'zw.z1.brightness',
      delta: 0,
      params: { palace: 'wealth', stars: 'tian_tong', brightness: 'ping' },
    });
  });
  it('matches the A–G golden snapshots (E has no birth time, so Zi Wei cannot be charted)', () => {
    expect(() => chartOf('E')).toThrow('E_REQUIRES_BIRTH_TIME');
    expect(Object.fromEntries([...'ABCDFG'].map((id) => [id, summary(chartOf(id))]))).toEqual({
      A: {
        top: ['career', 'social'],
        career: '4 1.25 z1.brightness+1 z6.malefic-0.25 z7.opposite+0.5',
        wealth: '2 -1 z1.brightness+0 z3.ji-1 z6.malefic-0.25 z7.opposite+0.25',
        love: '3 0 z1.brightness-1 z3.lu+1',
        social: '4 0.75 z1.brightness+0.5 z4.lucky+0.25',
      },
      B: {
        top: ['wealth', 'social'],
        career: '4 1 z1.brightness+1 z4.lucky+0.25 z6.malefic-0.25',
        wealth: '5 1.5 z1.brightness+1 z8a.wealth_star+0.5',
        love: '3 0.25 z1.brightness+0 z4.lucky+0.25',
        social: '4 1.25 z2.borrowed+0.5 z5.lu_cun+0.5 z6.malefic-0.25 z7.opposite+0.5',
      },
      C: {
        top: ['love', 'wealth'],
        career: '4 0.875 z2.borrowed+0.5 z6.malefic-0.5 z7.opposite+0.5 z7.opposite+0.375',
        wealth: '4 1.25 z1.brightness+0.5 z4.lucky+0.25 z8a.wealth_star+0.5',
        love: '5 2.5 z1.brightness+1 z3.lu+1 z3.quan+0.75 z6.malefic-0.25',
        social: '3 0 z2.borrowed+0.5 z4.lucky+0.25 z6.malefic-0.25 z7.opposite-0.5',
      },
      D: {
        top: ['love', 'career'],
        career: '4 1.125 z1.brightness+1 z4.lucky+0.25 z6.malefic-0.5 z7.opposite+0.375',
        wealth: '3 0.375 z2.borrowed+0.375 z4.lucky+0.25 z6.malefic-0.25',
        love: '5 2 z1.brightness+1 z3.quan+0.75 z4.lucky+0.25',
        social: '3 0 z2.borrowed-0.5 z5.lu_cun+0.5 z6.malefic-0.5 z7.opposite+0.5',
      },
      F: {
        top: ['career', 'love'],
        career: '5 2.5 z1.brightness+1 z3.lu+1 z4.lucky+0.5',
        wealth: '3 0 z1.brightness+1 z3.ji-1',
        love: '4 1.25 z1.brightness+0.5 z5.lu_cun+0.5 z6.malefic-0.25 z7.opposite+0.5',
        social: '2 -1 z1.brightness-1',
      },
      G: {
        top: ['social', 'career'],
        career: '4 0.75 z1.brightness+1 z6.malefic-0.25',
        wealth: '2 -0.25 z1.brightness+0 z6.malefic-0.25',
        love: '2 -1.25 z1.brightness-1 z4.lucky+0.25 z6.malefic-0.5',
        social: '4 1 z1.brightness+0.5 z5.lu_cun+0.5',
      },
    });
  });
  it('is deterministic: repeated runs are deeply equal', () => {
    for (const id of 'ABCDFG') {
      const chart = chartOf(id);
      expect(ziweiEmphasis(structuredClone(chart))).toEqual(ziweiEmphasis(chart));
    }
  });
  it('caps groups, clamps at ±2.5, borrows at half strength and orders top by raw then dims', () => {
    const lucky = ['zuo_fu', 'you_bi', 'wen_chang', 'wen_qu'] as const;
    const strong = palace({
      majorStars: [{ key: 'wu_qu', brightness: 'miao' }],
      mutagens: [
        { star: 'wu_qu', mutagen: 'lu' },
        { star: 'wen_chang', mutagen: 'quan' },
      ],
      lucky: [...lucky],
      stars: ['wu_qu', ...lucky],
      brightnessOf: { wu_qu: 'miao' },
    });
    const flat = palace({
      majorStars: [{ key: 'tian_tong', brightness: 'ping' }],
      stars: ['tian_tong'],
    });
    const empty = palace({ empty: true });
    const opposite = palace({
      palace: 'spouse',
      majorStars: [
        { key: 'lian_zhen', brightness: 'li' },
        { key: 'tian_xiang', brightness: 'ping' },
      ],
      stars: ['lian_zhen', 'tian_xiang'],
    });
    const result = evaluateEmphasis(
      {
        career: { self: strong, opposite: flat },
        wealth: { self: empty, opposite },
        love: { self: flat, opposite: flat },
        social: { self: strong, opposite: flat },
      },
      ziweiScoringRules,
    );
    // 1 + 1 (禄) + 0.75 (权) + 0.75 (four 六吉 capped) = 3.5 → clamp 2.5.
    expect(result.dims.career?.raw).toBe(2.5);
    expect(result.dims.career?.basis.find((b) => b.ruleId === 'zw.z4.lucky')?.delta).toBe(0.75);
    // (0.5 + 0) / 2 × 0.5 = 0.125: eighths, not quarters.
    expect(result.dims.wealth).toMatchObject({ raw: 0.125, level: 3 });
    expect(result.dims.wealth?.basis[0]?.params).toEqual({
      palace: 'career',
      opposite: 'spouse',
      stars: 'lian_zhen,tian_xiang',
      brightness: 'li,ping',
    });
    expect(result.top).toEqual(['career', 'social']);
    const none = evaluateEmphasis(
      Object.fromEntries(
        ['career', 'wealth', 'love', 'social'].map((d) => [d, { self: flat, opposite: flat }]),
      ),
      ziweiScoringRules,
    );
    expect(none.top).toEqual([]);
    expect(Object.values(none.dims).map((d) => d.level)).toEqual([3, 3, 3, 3]);
  });
  it('bands raw scores at the frozen cutpoints', () => {
    const rules: CompiledScoringRules = { ...ziweiScoringRules, rules: [] };
    const flat = palace({});
    const view = Object.fromEntries(
      ['career', 'wealth', 'love', 'social'].map((d) => [d, { self: flat, opposite: flat }]),
    );
    expect(evaluateEmphasis(view, { ...rules, cutpoints: [1, 2, 3] }).dims.career?.level).toBe(2);
    expect(evaluateEmphasis(view, { ...rules, cutpoints: [0, 2, 3] }).dims.career?.level).toBe(3);
    expect(evaluateEmphasis(view, { ...rules, cutpoints: [-2, -1, 0] }).dims.career?.level).toBe(5);
    expect(ziweiScoringRules.cutpoints).toEqual([0, 6, 11]);
  });
});
describe('emphasis copy', () => {
  it('renders Fixture A basis in zh, en and generated zh-TW with no unresolved placeholders', () => {
    const emphasis = ziweiEmphasis(A);
    const career = emphasis.dims.career!.basis;
    expect(renderEmphasisBasis(career[0]!, 'zh')).toBe(
      '官禄宫有巨门（旺），主星在这里发挥得比较顺，传统上视为这一领域的底气。',
    );
    expect(renderEmphasisBasis(career[2]!, 'en')).toBe(
      'Tai Yang (Sun) with the Prosperity transformation in the opposite Spouse Palace shines across to your Career Palace — traditionally support that arrives from outside.',
    );
    expect(renderEmphasisBasis(emphasis.dims.social!.basis[0]!, 'zh-TW')).toBe(
      '交友宮有廉貞（平）、天相（廟），主星在這裡發揮得比較順，傳統上視為這一領域的底氣。',
    );
    for (const locale of ['zh', 'en', 'zh-TW'] as const)
      for (const dim of Object.values(emphasis.dims))
        for (const basis of dim.basis) {
          const text = renderEmphasisBasis(basis, locale);
          expect(text).not.toMatch(/[{}]|undefined/);
          expect(text.length).toBeGreaterThan(10);
        }
    expect(renderEmphasisBasis({ ruleId: 'zw.unknown', delta: 1, params: {} }, 'zh')).toBe('');
    expect(emphasisOverview(emphasis, 'zh')).toBe('你的盘面侧重在事业与人际。');
    expect(emphasisOverview(emphasis, 'en', 1)).toBe('Your chart leans toward career.');
    expect(emphasisOverview({ top: [] }, 'zh-TW')).toBe(
      '你的盤面各方面比較均衡，沒有特別突出的一塊。',
    );
    expect(emphasisLevelLabel(2, 'en')).toBe('Takes more care');
    expect(emphasisLevelLabel(5, 'zh')).toBe('突出');
    expect(emphasisDimSentence('wealth', 2, 'zh')).toContain('给开销定几条简单规则');
    expect(emphasisFootnotes('zh').disclaimer).toBe(
      '侧重来自传统规则的组合，看的是这张盘里各领域的相对重心，不代表结果。',
    );
  });
  it('passes the banned-word list, gives every negative rule advice and keeps locales aligned', () => {
    const { zh, en } = ziweiScoringCopy.locales;
    const tw = ziweiScoringCopy.locales['zh-TW'];
    for (const rule of ziweiScoringRules.rules) {
      for (const locale of [zh, en, tw]) {
        const copy = locale.rules[rule.id];
        expect(copy, rule.id).toBeDefined();
        if (copy?.negative) expect(copy.advice?.length, rule.id).toBeGreaterThan(5);
      }
      const names = (text = '') => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
      for (const variant of ['positive', 'zero', 'negative'] as const)
        expect(names(en.rules[rule.id]?.[variant]), `${rule.id} ${variant}`).toEqual(
          names(zh.rules[rule.id]?.[variant]),
        );
    }
    const strings = (value: unknown): string[] =>
      typeof value === 'string'
        ? [value]
        : value && typeof value === 'object'
          ? Object.values(value).flatMap(strings)
          : [];
    for (const [locale, copy] of [
      ['zh', zh],
      ['en', en],
    ] as const)
      for (const text of strings({ ...copy, terms: {} }))
        for (const word of [...banned[locale], ...positioningBanned[locale]])
          expect(
            locale === 'zh' ? text.includes(word) : new RegExp(`\\b${word}\\b`, 'i').test(text),
            `${word} in ${text}`,
          ).toBe(false);
    // Every band sentence for the lowest band is gentle and actionable (proposal §3.2).
    for (const dim of ziweiScoringRules.dims) expect(zh.sentences[dim]?.['2']).toMatch(/[，；]/);
    expect(tw.title).toBe('命盤側重');
  });
});
