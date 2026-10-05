import { type Element, type TenGod } from '@tianji/shared';
import { describe, expect, it } from 'vitest';
import en from '../../../apps/web/messages/en.json';
import zh from '../../../apps/web/messages/zh.json';
import {
  ALMANAC_MAPPING,
  BRANCHES,
  branchRelations,
  COLOR_FAMILIES,
  computeDaily,
  fiveRat,
  goodHours,
  luckyColor,
  mapAlmanac,
  nobleZodiac,
  selectDailyActions,
  STEM_ELEMENTS,
  STEMS,
} from '../src';
import { daily, input } from './daily-fixtures';

describe('lucky indicators, strict almanac whitelist and action keys', () => {
  it('covers every family, correct numbers/direction, and seed-stable shade selection', () => {
    for (const element of Object.keys(COLOR_FAMILIES) as Element[])
      for (let i = 0; i < 12; i++) {
        const color = luckyColor(element, `color-seed-${i}`);
        expect(
          COLOR_FAMILIES[element].some(
            ([name, hex]) => color.name === `daily.color.${name}` && color.hex === hex,
          ),
        ).toBe(true);
        expect(luckyColor(element, `color-seed-${i}`)).toEqual(color);
      }
  });
  it('selects two favorable, non-clashing hours and falls back with wrapped Zi endpoints', () => {
    for (const stem of STEMS)
      for (const branch of BRANCHES) {
        const hours = goodHours(stem, branch, ['wood', 'fire']);
        expect(hours).toHaveLength(2);
        expect(new Set(hours.map((h) => h.branch)).size).toBe(2);
        expect(hours.every((h) => !branchRelations(h.branch, branch).includes('clash'))).toBe(true);
        expect(
          hours.every((h) => ['wood', 'fire'].includes(STEM_ELEMENTS[fiveRat(stem, h.branch)])),
        ).toBe(true);
      }
    expect(goodHours('jia', 'zi', [])).toEqual([
      { branch: 'zi', from: '23:00', to: '01:00' },
      { branch: 'chou', from: '01:00', to: '03:00' },
    ]);
    expect(nobleZodiac('zi')).toEqual(['chou', 'chen', 'shen']);
  });
  it('whitelists/maps/deduplicates §6 and never emits unknown or forbidden tokens', () => {
    const blocked = [
      '安葬',
      '破土',
      '启钻',
      '除服',
      '成服',
      '伐木',
      '作梁',
      '上梁',
      '掘井',
      '纳畜',
      '开仓',
      '谢土',
      '未知',
    ];
    expect(mapAlmanac(blocked)).toEqual([]);
    expect(mapAlmanac(['开市', '交易', '立券', '纳财', '出行', '安葬'])).toEqual([
      'daily.almanac.deals',
      'daily.almanac.travel',
    ]);
    expect(mapAlmanac(Object.keys(ALMANAC_MAPPING))).toHaveLength(12);
    expect(
      [...daily.bazi.almanac.yi, ...daily.bazi.almanac.ji].every((key) =>
        key.startsWith('daily.almanac.'),
      ),
    ).toBe(true);
  });
  it('selects matching KU actions by weight, seed-shuffles ties, blocks aliases and all conflicts', () => {
    const findings = daily.findings;
    const units = [
      {
        id: 'matched',
        findings: [findings[0]!],
        weight: 20,
        do: [
          'daily.actions.review',
          'daily.actions.review',
          'daily.actions.listen',
          'daily.almanac.travel',
          'daily.actions.romance',
        ],
        dont: ['daily.actions.listen', 'daily.actions.rush'],
      },
      {
        id: 'low',
        findings: [findings[0]!],
        weight: 2,
        do: ['daily.actions.ask'],
        dont: ['daily.actions.overpromise'],
      },
      {
        id: 'irrelevant',
        findings: ['not.matched'],
        weight: 100,
        do: ['test.ignored'],
        dont: ['test.ignored'],
      },
    ];
    const result = selectDailyActions(input.seed, findings, daily.bazi.almanac, units);
    expect(result.do).toContain('daily.actions.review');
    expect(result.do).toContain('daily.actions.ask');
    const all = [...result.do, ...result.dont];
    expect(new Set(all).size).toBe(6);
    expect(all).not.toContain('daily.almanac.travel');
    expect(all).not.toContain('daily.actions.romance');
    expect(all).not.toContain('test.ignored');
    expect(selectDailyActions(input.seed, findings, daily.bazi.almanac, units)).toEqual(result);
    expect(computeDaily(input, { actionUnits: units }).doDont).toEqual(result);
    expect(selectDailyActions('one', [], daily.bazi.almanac)).not.toEqual(
      selectDailyActions('two', [], daily.bazi.almanac),
    );
  });
  it('provides bilingual next-intl copy for every emitted indicator/action/oneliner key', () => {
    const catalogs: Record<string, string>[] = [zh, en];
    const keys = [
      ...daily.bazi.luckyColor,
      daily.bazi.luckyDirection,
      ...daily.bazi.almanac.yi,
      ...daily.bazi.almanac.ji,
      ...daily.doDont.do,
      ...daily.doDont.dont,
      daily.oneLiner,
    ];
    for (const c of catalogs) for (const key of keys) expect(c[key]).toBeTruthy();
    for (const god of [
      'bi_jian',
      'jie_cai',
      'shi_shen',
      'shang_guan',
      'zheng_cai',
      'pian_cai',
      'zheng_guan',
      'qi_sha',
      'zheng_yin',
      'pian_yin',
    ] as TenGod[])
      for (const band of ['great', 'good', 'mixed', 'careful']) {
        const key = `daily.oneliner.${band}.${god}`;
        expect(zh[key as keyof typeof zh].length).toBeLessThanOrEqual(40);
        expect(en[key as keyof typeof en].split(/\s+/).length).toBeLessThanOrEqual(25);
      }
    const almanac = [...daily.bazi.almanac.yi, ...daily.bazi.almanac.ji];
    for (const list of [daily.doDont.do, daily.doDont.dont]) {
      expect(list).toHaveLength(3);
      expect(new Set(list).size).toBe(3);
      expect(list.some((key) => almanac.includes(key))).toBe(false);
      for (const key of list) {
        expect(catalogs[0]![key]!.length).toBeLessThanOrEqual(6);
        expect(catalogs[1]![key]!.split(/\s+/).length).toBeLessThanOrEqual(3);
      }
    }
  });
});
