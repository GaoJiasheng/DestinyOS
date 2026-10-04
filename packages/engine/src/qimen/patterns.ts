import { type QimenPalace, type Stem, type GateKey, type DeityKey } from '@tianji/shared';
import { STEMS } from '../common/ganzhi';
export type PatternContext = {
  palace: QimenPalace;
  zhiShiPalace: number;
  dayStem: Stem;
  hourStem: Stem;
  yi: Stem;
};
export type PatternRule = {
  key: string;
  auspicious: boolean;
  condition: {
    sky?: Stem;
    earth?: Stem | readonly Stem[];
    gate?: GateKey;
    deity?: DeityKey;
    index?: number;
    zhiShi?: boolean;
    dayEarth?: boolean;
    daySky?: boolean;
    xunEarth?: boolean;
    xunSky?: boolean;
    fiveMismatch?: boolean;
  };
};
// DESIGN-GAP: §3.7 names patterns without full predicates. Fix one common rotating-school reading per explicit rule; do not mix variants at runtime.
// Primary readings for unspecified predicates: 奇門法竅 卷六 (升殿/玉女), 奇門旨歸 卷四 (伏干/飛干), 奇門遁甲統宗.
// DESIGN-GAP: Jia's stem placement uses the hour's concealed xun instrument, consistently with day/hour use-god placement.
export const PATTERN_RULES: readonly PatternRule[] = [
  { key: 'san_qi_de_shi_yi', auspicious: true, condition: { sky: 'yi', earth: ['xin', 'ji'] } },
  {
    key: 'san_qi_de_shi_bing',
    auspicious: true,
    condition: { sky: 'bing', earth: ['wu_stem', 'geng'] },
  },
  {
    key: 'san_qi_de_shi_ding',
    auspicious: true,
    condition: { sky: 'ding', earth: ['gui', 'ren'] },
  },
  { key: 'san_qi_sheng_dian_yi', auspicious: true, condition: { sky: 'yi', index: 3 } },
  { key: 'san_qi_sheng_dian_bing', auspicious: true, condition: { sky: 'bing', index: 9 } },
  { key: 'san_qi_sheng_dian_ding', auspicious: true, condition: { sky: 'ding', index: 7 } },
  { key: 'qing_long_fan_shou', auspicious: true, condition: { sky: 'wu_stem', earth: 'bing' } },
  { key: 'fei_niao_die_xue', auspicious: true, condition: { sky: 'bing', earth: 'wu_stem' } },
  { key: 'yu_nv_shou_men', auspicious: true, condition: { earth: 'ding', zhiShi: true } },
  { key: 'tian_dun', auspicious: true, condition: { sky: 'bing', earth: 'ding', gate: 'sheng' } },
  { key: 'di_dun', auspicious: true, condition: { sky: 'yi', earth: 'ji', gate: 'kai' } },
  { key: 'ren_dun', auspicious: true, condition: { sky: 'ding', gate: 'xiu', deity: 'tai_yin' } },
  { key: 'feng_dun', auspicious: true, condition: { sky: 'yi', gate: 'xiu', index: 4 } },
  { key: 'yun_dun', auspicious: true, condition: { sky: 'yi', earth: 'xin', gate: 'kai' } },
  {
    key: 'long_dun',
    auspicious: true,
    condition: { sky: 'yi', earth: 'gui', gate: 'xiu', index: 1 },
  },
  {
    key: 'hu_dun',
    auspicious: true,
    condition: { sky: 'yi', earth: 'xin', gate: 'xiu', index: 8 },
  },
  {
    key: 'shen_dun',
    auspicious: true,
    condition: { sky: 'bing', gate: 'sheng', deity: 'jiu_tian' },
  },
  { key: 'gui_dun', auspicious: true, condition: { sky: 'ding', gate: 'du', deity: 'jiu_di' } },
  { key: 'qing_long_tao_zou', auspicious: false, condition: { sky: 'yi', earth: 'xin' } },
  { key: 'bai_hu_chang_kuang', auspicious: false, condition: { sky: 'xin', earth: 'yi' } },
  { key: 'zhu_que_tou_jiang', auspicious: false, condition: { sky: 'ding', earth: 'gui' } },
  { key: 'teng_she_yao_jiao', auspicious: false, condition: { sky: 'gui', earth: 'ding' } },
  { key: 'tai_bai_ru_ying', auspicious: false, condition: { sky: 'geng', earth: 'bing' } },
  { key: 'ying_ru_tai_bai', auspicious: false, condition: { sky: 'bing', earth: 'geng' } },
  { key: 'da_ge', auspicious: false, condition: { sky: 'geng', earth: 'gui' } },
  { key: 'xiao_ge', auspicious: false, condition: { sky: 'geng', earth: 'ren' } },
  { key: 'xing_ge', auspicious: false, condition: { sky: 'geng', earth: 'ji' } },
  { key: 'qi_ge', auspicious: false, condition: { sky: 'geng', earth: 'yi' } },
  { key: 'fu_gan_ge', auspicious: false, condition: { sky: 'geng', dayEarth: true } },
  { key: 'fei_gan_ge', auspicious: false, condition: { earth: 'geng', daySky: true } },
  { key: 'wu_bu_yu_shi', auspicious: false, condition: { fiveMismatch: true } },
  { key: 'ri_yue_bing_xing', auspicious: true, condition: { sky: 'bing', earth: 'yi' } },
  { key: 'qi_yi_xiang_zuo', auspicious: true, condition: { sky: 'yi', earth: 'ding' } },
  { key: 'xing_qi_zhu_que', auspicious: true, condition: { sky: 'bing', earth: 'ding' } },
  { key: 'qi_ru_tai_yin', auspicious: true, condition: { sky: 'ding', earth: 'ding' } },
  {
    key: 'san_qi_ru_mu_bing',
    auspicious: false,
    condition: { sky: 'bing', earth: 'wu_stem', index: 6 },
  },
  { key: 'fu_gong_ge', auspicious: false, condition: { sky: 'geng', xunEarth: true } },
  { key: 'fei_gong_ge', auspicious: false, condition: { earth: 'geng', xunSky: true } },
  { key: 'tian_wang_si_zhang', auspicious: false, condition: { sky: 'gui', earth: 'gui' } },
  { key: 'tian_yu', auspicious: false, condition: { sky: 'ren', earth: 'ren' } },
];
/** Match a rule against the complete palace/context, retaining auditable predicates. */
export function matchesPattern(rule: PatternRule, context: PatternContext): boolean {
  const c = rule.condition,
    p = context.palace;
  if (c.sky && p.skyStem !== c.sky) return false;
  if (
    c.earth &&
    (typeof c.earth === 'string' ? p.earthStem !== c.earth : !c.earth.includes(p.earthStem))
  )
    return false;
  if (c.gate && p.gate !== c.gate) return false;
  if (c.deity && p.deity !== c.deity) return false;
  if (c.index && p.index !== c.index) return false;
  if (c.zhiShi && p.index !== context.zhiShiPalace) return false;
  const dayStem = context.dayStem === 'jia' ? context.yi : context.dayStem;
  if (c.dayEarth && p.earthStem !== dayStem) return false;
  if (c.daySky && p.skyStem !== dayStem) return false;
  if (c.xunEarth && p.earthStem !== context.yi) return false;
  if (c.xunSky && p.skyStem !== context.yi) return false;
  if (
    c.fiveMismatch &&
    (STEMS.indexOf(context.hourStem) - STEMS.indexOf(context.dayStem) + 10) % 10 !== 6
  )
    return false;
  return true;
}
/** Keys of the pattern table that match one palace. */
export function detectPatterns(context: PatternContext): string[] {
  return PATTERN_RULES.filter((rule) => matchesPattern(rule, context)).map((rule) => rule.key);
}
