import {
  type SolarTerm,
  type Stem,
  type Branch,
  type StarKey,
  type GateKey,
  type DeityKey,
  type Trigram,
  type Direction,
  type Element,
} from '@tianji/shared';
import { mod, ganZhiIndex, ganZhiAt } from '../common/ganzhi';
export const JU_TABLE: Record<SolarTerm, readonly [number, number, number]> = {
  dong_zhi: [1, 7, 4],
  xiao_han: [2, 8, 5],
  da_han: [3, 9, 6],
  li_chun: [8, 5, 2],
  yu_shui: [9, 6, 3],
  jing_zhe: [1, 7, 4],
  chun_fen: [3, 9, 6],
  qing_ming: [4, 1, 7],
  gu_yu: [5, 2, 8],
  li_xia: [4, 1, 7],
  xiao_man: [5, 2, 8],
  mang_zhong: [6, 3, 9],
  xia_zhi: [9, 3, 6],
  xiao_shu: [8, 2, 5],
  da_shu: [7, 1, 4],
  li_qiu: [2, 5, 8],
  chu_shu: [1, 4, 7],
  bai_lu: [9, 3, 6],
  qiu_fen: [7, 1, 4],
  han_lu: [6, 9, 3],
  shuang_jiang: [5, 8, 2],
  li_dong: [6, 9, 3],
  xiao_xue: [5, 8, 2],
  da_xue: [4, 7, 1],
};
export const YANG_TERMS: readonly SolarTerm[] = [
  'dong_zhi',
  'xiao_han',
  'da_han',
  'li_chun',
  'yu_shui',
  'jing_zhe',
  'chun_fen',
  'qing_ming',
  'gu_yu',
  'li_xia',
  'xiao_man',
  'mang_zhong',
];
export const EARTH_SEQUENCE: readonly Stem[] = [
  'wu_stem',
  'ji',
  'geng',
  'xin',
  'ren',
  'gui',
  'ding',
  'bing',
  'yi',
];
export const RING = [1, 8, 3, 4, 9, 2, 7, 6] as const;
export const STARS: readonly StarKey[] = [
  'tian_peng',
  'tian_rui',
  'tian_chong',
  'tian_fu',
  'tian_qin',
  'tian_xin',
  'tian_zhu',
  'tian_ren',
  'tian_ying',
];
export const GATES: readonly (GateKey | null)[] = [
  'xiu',
  'si',
  'shang',
  'du',
  null,
  'kai',
  'jing',
  'sheng',
  'jing_view',
];
export const DEITIES: readonly DeityKey[] = [
  'zhi_fu',
  'teng_she',
  'tai_yin',
  'liu_he',
  'bai_hu',
  'xuan_wu',
  'jiu_di',
  'jiu_tian',
];
export const PALACE_TRIGRAMS: readonly (Trigram | null)[] = [
  'kan',
  'kun',
  'zhen',
  'xun',
  null,
  'qian',
  'dui',
  'gen',
  'li',
];
export const DIRECTIONS: readonly Direction[] = [
  'north',
  'southwest',
  'east',
  'southeast',
  'center',
  'northwest',
  'west',
  'northeast',
  'south',
];
export const PALACE_ELEMENTS: readonly Element[] = [
  'water',
  'earth',
  'wood',
  'wood',
  'earth',
  'metal',
  'metal',
  'earth',
  'fire',
];
export const GATE_ELEMENTS: Record<GateKey, Element> = {
  xiu: 'water',
  si: 'earth',
  shang: 'wood',
  du: 'wood',
  kai: 'metal',
  jing: 'metal',
  sheng: 'earth',
  jing_view: 'fire',
};
export const STAR_ELEMENTS: Record<StarKey, Element> = {
  tian_peng: 'water',
  tian_rui: 'earth',
  tian_chong: 'wood',
  tian_fu: 'wood',
  tian_qin: 'earth',
  tian_xin: 'metal',
  tian_zhu: 'metal',
  tian_ren: 'earth',
  tian_ying: 'fire',
};
export const GOOD_GATES: readonly GateKey[] = ['xiu', 'sheng', 'kai'];
export const GOOD_STARS: readonly StarKey[] = ['tian_fu', 'tian_xin', 'tian_ren', 'tian_qin'];
export const BRANCH_PALACE: Record<Branch, number> = {
  zi: 1,
  chou: 8,
  yin: 8,
  mao: 3,
  chen: 4,
  si: 4,
  wu: 9,
  wei: 2,
  shen: 2,
  you: 7,
  xu: 6,
  hai: 6,
};
export const JI_XING: Partial<Record<Stem, number>> = {
  wu_stem: 3,
  ji: 2,
  geng: 8,
  xin: 9,
  ren: 4,
  gui: 4,
};
export const RU_MU: Partial<Record<Stem, number>> = {
  bing: 6,
  wu_stem: 6,
  yi: 2,
  gui: 2,
  ding: 8,
  ji: 8,
  xin: 4,
  ren: 4,
  geng: 8,
};
/** Numeric Lo Shu earth placement for either dun; returns stems at indexes 1–9. */
export function earthPlate(dun: 'yang' | 'yin', ju: number): Stem[] {
  const earth: Stem[] = [];
  EARTH_SEQUENCE.forEach((stem, i) => {
    earth[mod(ju - 1 + (dun === 'yang' ? i : -i), 9)] = stem;
  });
  return earth;
}
/** Hour xun head and its concealed instrument. */
export function xunShou(hour: { stem: Stem; branch: Branch }) {
  const index = ganZhiIndex(hour.stem, hour.branch),
    xun = Math.floor(index / 10);
  return {
    stem: 'jia' as const,
    branch: ganZhiAt(xun * 10).branch,
    yi: EARTH_SEQUENCE[xun]!,
    offset: index % 10,
  };
}
/** Hour-branch travelling horse, by the four trines. */
export function horseBranch(branch: Branch): Branch {
  return (
    {
      shen: 'yin',
      zi: 'yin',
      chen: 'yin',
      yin: 'shen',
      wu: 'shen',
      xu: 'shen',
      si: 'hai',
      you: 'hai',
      chou: 'hai',
      hai: 'si',
      mao: 'si',
      wei: 'si',
    } as const
  )[branch];
}
/** Middle palace is hosted in the selected outer palace, default Kun 2. */
export function lodge(index: number, center: 2 | 8 = 2): number {
  return index === 5 ? center : index;
}
