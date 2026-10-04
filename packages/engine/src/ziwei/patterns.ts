import type { Branch, Brightness, Mutagen, PatternHit, StarKey, ZiweiChart } from '@tianji/shared';
type Scope = 'life' | 'triangle' | 'flanks' | 'travel' | 'wealth' | 'career';
type Condition = {
  scope: Scope;
  stars?: readonly StarKey[];
  branches?: readonly Branch[];
  brightness?: readonly Brightness[];
  mutagen?: Mutagen;
  empty?: boolean;
};
type Rule = { key: string; conditions: readonly Condition[] };
// DESIGN-GAP: §7 only names patterns. These explicit mainstream structural predicates are the project baseline;
// strength is evidence brightness (0–1), and auspicious-pattern purity/wealth promises are not inferred.
export const ZIWEI_PATTERN_RULES: readonly Rule[] = [
  // 紫府同宫：命宫紫微、天府同坐。
  { key: 'zi_fu_tong_gong', conditions: [{ scope: 'life', stars: ['zi_wei', 'tian_fu'] }] },
  // 紫府朝垣：命、财、官、迁四宫会齐紫微天府。
  { key: 'zi_fu_chao_yuan', conditions: [{ scope: 'triangle', stars: ['zi_wei', 'tian_fu'] }] },
  // 府相朝垣：命宫三方四正会天府、天相。
  {
    key: 'fu_xiang_chao_yuan',
    conditions: [{ scope: 'triangle', stars: ['tian_fu', 'tian_xiang'] }],
  },
  // 君臣庆会：紫微坐命，三方四正左右辅弼会齐。
  {
    key: 'jun_chen_qing_hui',
    conditions: [
      { scope: 'life', stars: ['zi_wei'] },
      { scope: 'triangle', stars: ['zuo_fu', 'you_bi'] },
    ],
  },
  // 紫微七杀：命宫二星同宫，紫微制杀。
  { key: 'zi_wei_qi_sha', conditions: [{ scope: 'life', stars: ['zi_wei', 'qi_sha'] }] },
  // 机月同梁：命宫三方四正会齐天机太阴天同天梁。
  {
    key: 'ji_yue_tong_liang',
    conditions: [{ scope: 'triangle', stars: ['tian_ji', 'tai_yin', 'tian_tong', 'tian_liang'] }],
  },
  // 杀破狼：命宫三方四正会七杀破军贪狼。
  {
    key: 'sha_po_lang',
    conditions: [{ scope: 'triangle', stars: ['qi_sha', 'po_jun', 'tan_lang'] }],
  },
  // 日月并明：三方四正太阳太阴均庙旺。
  {
    key: 'ri_yue_bing_ming',
    conditions: [
      { scope: 'triangle', stars: ['tai_yang', 'tai_yin'], brightness: ['miao', 'wang'] },
    ],
  },
  // 日月反背：三方四正太阳太阴均不陷。
  {
    key: 'ri_yue_fan_bei',
    conditions: [{ scope: 'triangle', stars: ['tai_yang', 'tai_yin'], brightness: ['bu', 'xian'] }],
  },
  // 明珠出海：未宫无主星，财帛卯太阳、官禄亥太阴庙旺。
  {
    key: 'ming_zhu_chu_hai',
    conditions: [
      { scope: 'life', branches: ['wei'], empty: true },
      { scope: 'wealth', branches: ['mao'], stars: ['tai_yang'], brightness: ['miao', 'wang'] },
      { scope: 'career', branches: ['hai'], stars: ['tai_yin'], brightness: ['miao', 'wang'] },
    ],
  },
  // 巨日同宫：寅申命宫巨门太阳同坐。
  {
    key: 'ju_ri_tong_gong',
    conditions: [{ scope: 'life', branches: ['yin', 'shen'], stars: ['ju_men', 'tai_yang'] }],
  },
  // 石中隐玉：子丑巨门坐命且本星化禄。
  {
    key: 'shi_zhong_yin_yu',
    conditions: [{ scope: 'life', branches: ['zi', 'chou'], stars: ['ju_men'], mutagen: 'lu' }],
  },
  // 阳梁昌禄：三方四正会太阳天梁文昌禄存。
  {
    key: 'yang_liang_chang_lu',
    conditions: [{ scope: 'triangle', stars: ['tai_yang', 'tian_liang', 'wen_chang', 'lu_cun'] }],
  },
  // 文桂文华：命宫文昌文曲同坐。
  { key: 'wen_gui_wen_hua', conditions: [{ scope: 'life', stars: ['wen_chang', 'wen_qu'] }] },
  // 禄马交驰：三方四正会禄存天马。
  { key: 'lu_ma_jiao_chi', conditions: [{ scope: 'triangle', stars: ['lu_cun', 'tian_ma'] }] },
  // 双禄朝垣：三方四正有禄存与生年化禄。
  {
    key: 'shuang_lu_chao_yuan',
    conditions: [
      { scope: 'triangle', stars: ['lu_cun'] },
      { scope: 'triangle', mutagen: 'lu' },
    ],
  },
  // 火贪格：命宫火星贪狼同坐。
  { key: 'huo_tan_ge', conditions: [{ scope: 'life', stars: ['huo_xing', 'tan_lang'] }] },
  // 铃贪格：命宫铃星贪狼同坐。
  { key: 'ling_tan_ge', conditions: [{ scope: 'life', stars: ['ling_xing', 'tan_lang'] }] },
  // 火铃夹命：命宫两邻宫分坐火星铃星。
  { key: 'huo_ling_jia_ming', conditions: [{ scope: 'flanks', stars: ['huo_xing', 'ling_xing'] }] },
  // 羊陀夹忌：命宫生年化忌，两邻宫分坐擎羊陀罗。
  {
    key: 'yang_tuo_jia_ji',
    conditions: [
      { scope: 'life', mutagen: 'ji' },
      { scope: 'flanks', stars: ['qing_yang', 'tuo_luo'] },
    ],
  },
  // 空劫夹命：命宫两邻宫分坐地空地劫。
  { key: 'kong_jie_jia_ming', conditions: [{ scope: 'flanks', stars: ['di_kong', 'di_jie'] }] },
  // 命无正曜：命宫无十四主星；保留对宫供下游借星。
  { key: 'ming_wu_zheng_yao', conditions: [{ scope: 'life', empty: true }] },
  // 禄逢两杀：禄存坐命并与火星铃星同宫。
  {
    key: 'lu_feng_liang_sha',
    conditions: [{ scope: 'life', stars: ['lu_cun', 'huo_xing', 'ling_xing'] }],
  },
  // 七杀朝斗：寅申子午七杀庙旺坐命，迁移紫微。
  {
    key: 'qi_sha_chao_dou',
    conditions: [
      {
        scope: 'life',
        branches: ['yin', 'shen', 'zi', 'wu'],
        stars: ['qi_sha'],
        brightness: ['miao', 'wang'],
      },
      { scope: 'travel', stars: ['zi_wei'] },
    ],
  },
  // 极居卯酉：卯酉命宫紫微贪狼同坐。
  {
    key: 'ji_ju_mao_you',
    conditions: [{ scope: 'life', branches: ['mao', 'you'], stars: ['zi_wei', 'tan_lang'] }],
  },
];
type Palace = ZiweiChart['palaces'][number];
function scopePalaces(chart: ZiweiChart, scope: Scope): Palace[] {
  const keys =
    scope === 'triangle'
      ? ['life', 'wealth', 'career', 'travel']
      : scope === 'flanks'
        ? ['siblings', 'parents']
        : [scope];
  return chart.palaces.filter((p) => keys.includes(p.key));
}
function conditionMatches(palaces: Palace[], condition: Condition): boolean {
  if (condition.branches && !palaces.some((p) => condition.branches!.includes(p.branch)))
    return false;
  if (
    condition.empty !== undefined &&
    !palaces.some((p) => (p.majorStars.length === 0) === condition.empty)
  )
    return false;
  const stars = palaces.flatMap((p) => [...p.majorStars, ...p.minorStars]);
  const matches = (star: (typeof stars)[number]) =>
    (!condition.brightness ||
      (star.brightness !== undefined && condition.brightness.includes(star.brightness))) &&
    (!condition.mutagen || star.mutagen === condition.mutagen);
  if (
    condition.stars &&
    !condition.stars.every((key) => stars.some((star) => star.key === key && matches(star)))
  )
    return false;
  if (!condition.stars && condition.mutagen && !stars.some(matches)) return false;
  if (condition.scope === 'flanks' && condition.stars) {
    const [a, b] = condition.stars;
    return (
      palaces.length === 2 &&
      ((palaces[0]!.minorStars.some((s) => s.key === a) &&
        palaces[1]!.minorStars.some((s) => s.key === b)) ||
        (palaces[1]!.minorStars.some((s) => s.key === a) &&
          palaces[0]!.minorStars.some((s) => s.key === b)))
    );
  }
  return true;
}
/** Detect 25 configurations from natal chart only; includes palace and star evidence, without mutating the chart. */
export function detectPatterns(chart: ZiweiChart): PatternHit[] {
  return ZIWEI_PATTERN_RULES.filter((rule) =>
    rule.conditions.every((c) => conditionMatches(scopePalaces(chart, c.scope), c)),
  ).map((rule) => {
    const evidence = rule.conditions.flatMap((c) =>
      scopePalaces(chart, c.scope).filter((p) =>
        c.stars
          ? [...p.majorStars, ...p.minorStars].some((s) => c.stars!.includes(s.key))
          : c.mutagen
            ? [...p.majorStars, ...p.minorStars].some((s) => s.mutagen === c.mutagen)
            : true,
      ),
    );
    const stars = [
      ...new Set(
        rule.conditions.flatMap(
          (c) =>
            c.stars ??
            (c.mutagen
              ? scopePalaces(chart, c.scope).flatMap((p) =>
                  [...p.majorStars, ...p.minorStars]
                    .filter((s) => s.mutagen === c.mutagen)
                    .map((s) => s.key),
                )
              : []),
        ),
      ),
    ];
    const scores = evidence.flatMap((p) =>
      p.majorStars
        .filter((s) => stars.includes(s.key))
        .map(
          (s) =>
            ({ miao: 1, wang: 1, de: 0.85, li: 0.85, ping: 0.7, bu: 0.5, xian: 0.5 })[s.brightness],
        ),
    );
    return {
      key: rule.key,
      palaces: [...new Set(evidence.map((p) => p.key))],
      stars,
      strength: scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 1,
    };
  });
}
