import { describe, expect, it } from 'vitest';
import {
  type ZiweiChart,
  type StarKey,
  type Palace,
  type Brightness,
  type Mutagen,
  type Branch,
} from '@tianji/shared';
import { computeZiwei, normalizeBirth, detectPatterns, ZIWEI_PATTERN_RULES } from '../src';
import A from './fixtures/birth/A.json';
const base = computeZiwei({ birth: normalizeBirth(A), now: '2026-10-04T00:00:00Z' });
type Placement = {
  palace: Palace;
  stars?: StarKey[];
  branch?: Branch;
  brightness?: Brightness;
  mutagen?: Mutagen;
  empty?: boolean;
};
const cases: [string, Placement[]][] = [
  ['zi_fu_tong_gong', [{ palace: 'life', stars: ['zi_wei', 'tian_fu'] }]],
  [
    'zi_fu_chao_yuan',
    [
      { palace: 'life', stars: ['zi_wei'] },
      { palace: 'career', stars: ['tian_fu'] },
    ],
  ],
  [
    'fu_xiang_chao_yuan',
    [
      { palace: 'career', stars: ['tian_fu'] },
      { palace: 'wealth', stars: ['tian_xiang'] },
    ],
  ],
  [
    'jun_chen_qing_hui',
    [
      { palace: 'life', stars: ['zi_wei'] },
      { palace: 'career', stars: ['zuo_fu', 'you_bi'] },
    ],
  ],
  ['zi_wei_qi_sha', [{ palace: 'life', stars: ['zi_wei', 'qi_sha'] }]],
  [
    'ji_yue_tong_liang',
    [
      { palace: 'life', stars: ['tian_ji', 'tai_yin'] },
      { palace: 'travel', stars: ['tian_tong', 'tian_liang'] },
    ],
  ],
  [
    'sha_po_lang',
    [
      { palace: 'life', stars: ['qi_sha'] },
      { palace: 'wealth', stars: ['po_jun'] },
      { palace: 'career', stars: ['tan_lang'] },
    ],
  ],
  [
    'ri_yue_bing_ming',
    [
      { palace: 'life', stars: ['tai_yang'], brightness: 'miao' },
      { palace: 'wealth', stars: ['tai_yin'], brightness: 'wang' },
    ],
  ],
  [
    'ri_yue_fan_bei',
    [
      { palace: 'life', stars: ['tai_yang'], brightness: 'bu' },
      { palace: 'wealth', stars: ['tai_yin'], brightness: 'xian' },
    ],
  ],
  [
    'ming_zhu_chu_hai',
    [
      { palace: 'life', empty: true, branch: 'wei' },
      { palace: 'wealth', stars: ['tai_yang'], brightness: 'miao', branch: 'mao' },
      { palace: 'career', stars: ['tai_yin'], brightness: 'wang', branch: 'hai' },
    ],
  ],
  ['ju_ri_tong_gong', [{ palace: 'life', stars: ['ju_men', 'tai_yang'], branch: 'yin' }]],
  ['shi_zhong_yin_yu', [{ palace: 'life', stars: ['ju_men'], branch: 'zi', mutagen: 'lu' }]],
  [
    'yang_liang_chang_lu',
    [
      { palace: 'life', stars: ['tai_yang', 'tian_liang'] },
      { palace: 'wealth', stars: ['wen_chang', 'lu_cun'] },
    ],
  ],
  ['wen_gui_wen_hua', [{ palace: 'life', stars: ['wen_chang', 'wen_qu'] }]],
  [
    'lu_ma_jiao_chi',
    [
      { palace: 'life', stars: ['lu_cun'] },
      { palace: 'travel', stars: ['tian_ma'] },
    ],
  ],
  [
    'shuang_lu_chao_yuan',
    [
      { palace: 'life', stars: ['lu_cun'] },
      { palace: 'wealth', stars: ['wu_qu'], mutagen: 'lu' },
    ],
  ],
  ['huo_tan_ge', [{ palace: 'life', stars: ['huo_xing', 'tan_lang'] }]],
  ['ling_tan_ge', [{ palace: 'life', stars: ['ling_xing', 'tan_lang'] }]],
  [
    'huo_ling_jia_ming',
    [
      { palace: 'siblings', stars: ['huo_xing'] },
      { palace: 'parents', stars: ['ling_xing'] },
    ],
  ],
  [
    'yang_tuo_jia_ji',
    [
      { palace: 'life', stars: ['wu_qu'], mutagen: 'ji' },
      { palace: 'siblings', stars: ['qing_yang'] },
      { palace: 'parents', stars: ['tuo_luo'] },
    ],
  ],
  [
    'kong_jie_jia_ming',
    [
      { palace: 'siblings', stars: ['di_kong'] },
      { palace: 'parents', stars: ['di_jie'] },
    ],
  ],
  ['ming_wu_zheng_yao', [{ palace: 'life', empty: true }]],
  ['lu_feng_liang_sha', [{ palace: 'life', stars: ['lu_cun', 'huo_xing', 'ling_xing'] }]],
  [
    'qi_sha_chao_dou',
    [
      { palace: 'life', stars: ['qi_sha'], branch: 'zi', brightness: 'wang' },
      { palace: 'travel', stars: ['zi_wei'] },
    ],
  ],
  ['ji_ju_mao_you', [{ palace: 'life', stars: ['zi_wei', 'tan_lang'], branch: 'mao' }]],
];
function chartWith(placements: Placement[]): ZiweiChart {
  const chart = structuredClone(base);
  for (const palace of chart.palaces) {
    palace.majorStars = [{ key: 'wu_qu', brightness: 'ping' }];
    palace.minorStars = [];
    palace.adjectiveStars = [];
  }
  for (const placement of placements) {
    const palace = chart.palaces.find((p) => p.key === placement.palace)!;
    if (placement.branch) palace.branch = placement.branch;
    if (placement.empty) palace.majorStars = [];
    if (placement.stars) {
      palace.majorStars = [];
      for (const key of placement.stars) {
        const star = {
          key,
          brightness: placement.brightness ?? 'ping',
          ...(placement.mutagen ? { mutagen: placement.mutagen } : {}),
        };
        if (
          [
            'zuo_fu',
            'you_bi',
            'wen_chang',
            'wen_qu',
            'lu_cun',
            'tian_ma',
            'huo_xing',
            'ling_xing',
            'qing_yang',
            'tuo_luo',
            'di_kong',
            'di_jie',
          ].includes(key)
        )
          palace.minorStars.push(star);
        else palace.majorStars.push(star);
      }
    }
  }
  return chart;
}
describe('25 independently specified pattern examples', () => {
  it('covers every named rule exactly once', () =>
    expect(cases.map(([key]) => key)).toEqual(ZIWEI_PATTERN_RULES.map((r) => r.key)));
  it.each(cases)(
    '%s positive and every required-star/branch/orientation negative',
    (key, placements) => {
      const chart = chartWith(placements),
        before = JSON.stringify(chart);
      const hit = detectPatterns(chart).find((p) => p.key === key)!;
      expect(hit).toBeDefined();
      expect(hit.palaces.length).toBeGreaterThan(0);
      expect(hit.strength).toBeGreaterThan(0);
      expect(JSON.stringify(chart)).toBe(before);
      for (const placement of placements) {
        for (const star of placement.stars ?? []) {
          const negative = structuredClone(chart),
            palace = negative.palaces.find((p) => p.key === placement.palace)!;
          palace.majorStars = palace.majorStars.filter((s) => s.key !== star);
          palace.minorStars = palace.minorStars.filter((s) => s.key !== star);
          expect(detectPatterns(negative).map((p) => p.key)).not.toContain(key);
        }
        if (placement.empty) {
          const negative = structuredClone(chart);
          negative.palaces[0]!.majorStars = [{ key: 'wu_qu', brightness: 'ping' }];
          expect(detectPatterns(negative).map((p) => p.key)).not.toContain(key);
        }
        if (placement.branch) {
          const negative = structuredClone(chart);
          negative.palaces.find((p) => p.key === placement.palace)!.branch = 'xu';
          expect(detectPatterns(negative).map((p) => p.key)).not.toContain(key);
        }
        if (placement.brightness) {
          const negative = structuredClone(chart);
          for (const s of negative.palaces.find((p) => p.key === placement.palace)!.majorStars)
            s.brightness = 'ping';
          expect(detectPatterns(negative).map((p) => p.key)).not.toContain(key);
        }
        if (placement.mutagen) {
          const negative = structuredClone(chart);
          for (const s of negative.palaces.find((p) => p.key === placement.palace)!.majorStars)
            delete s.mutagen;
          expect(detectPatterns(negative).map((p) => p.key)).not.toContain(key);
        }
      }
    },
  );
  it.each(['huo_ling_jia_ming', 'yang_tuo_jia_ji', 'kong_jie_jia_ming'])(
    'requires %s on different adjacent palaces, in either order',
    (key) => {
      const placements = cases.find(([k]) => k === key)![1];
      const chart = chartWith(placements),
        a = chart.palaces[1]!,
        b = chart.palaces[11]!;
      [a.minorStars, b.minorStars] = [b.minorStars, a.minorStars];
      expect(detectPatterns(chart).map((p) => p.key)).toContain(key);
      a.minorStars.push(...b.minorStars);
      b.minorStars = [];
      expect(detectPatterns(chart).map((p) => p.key)).not.toContain(key);
    },
  );
  it('does not use unrelated palaces or brightness-less minor stars to qualify luminaries', () => {
    const chart = chartWith([
      { palace: 'spouse', stars: ['tai_yang', 'tai_yin'], brightness: 'miao' },
    ]);
    expect(detectPatterns(chart).map((p) => p.key)).not.toContain('ri_yue_bing_ming');
    chart.palaces[0]!.majorStars = [];
    chart.palaces[0]!.minorStars = [{ key: 'tai_yang' }, { key: 'tai_yin' }];
    expect(detectPatterns(chart).map((p) => p.key)).not.toContain('ri_yue_bing_ming');
  });
});
