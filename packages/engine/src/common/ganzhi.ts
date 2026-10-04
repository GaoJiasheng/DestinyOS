import { Stem, Branch, Element, TenGod, LifeStage, NaYin, type YinYang } from '@tianji/shared';
import { EngineError } from './error';
export const STEMS = Object.values(Stem);
export const BRANCHES = Object.values(Branch);
export const ELEMENTS = Object.values(Element);
export const LIFE_STAGES = Object.values(LifeStage);
export const STEM_ELEMENTS: Record<Stem, Element> = {
  jia: 'wood',
  yi: 'wood',
  bing: 'fire',
  ding: 'fire',
  wu_stem: 'earth',
  ji: 'earth',
  geng: 'metal',
  xin: 'metal',
  ren: 'water',
  gui: 'water',
};
export const BRANCH_ELEMENTS: Record<Branch, Element> = {
  zi: 'water',
  chou: 'earth',
  yin: 'wood',
  mao: 'wood',
  chen: 'earth',
  si: 'fire',
  wu: 'fire',
  wei: 'earth',
  shen: 'metal',
  you: 'metal',
  xu: 'earth',
  hai: 'water',
};
export const HIDDEN_STEMS: Record<Branch, readonly Stem[]> = {
  zi: ['gui'],
  chou: ['ji', 'gui', 'xin'],
  yin: ['jia', 'bing', 'wu_stem'],
  mao: ['yi'],
  chen: ['wu_stem', 'yi', 'gui'],
  si: ['bing', 'wu_stem', 'geng'],
  wu: ['ding', 'ji'],
  wei: ['ji', 'ding', 'yi'],
  shen: ['geng', 'ren', 'wu_stem'],
  you: ['xin'],
  xu: ['wu_stem', 'xin', 'ding'],
  hai: ['ren', 'jia'],
};
export const STEM_YIN_YANG = Object.fromEntries(
  STEMS.map((stem, i) => [stem, i % 2 ? 'yin' : 'yang']),
) as Record<Stem, YinYang>;
export const BRANCH_YIN_YANG = Object.fromEntries(
  BRANCHES.map((branch, i) => [branch, i % 2 ? 'yin' : 'yang']),
) as Record<Branch, YinYang>;
/** Nonnegative modulo; period must be a positive integer. */
export function mod(value: number, period: number): number {
  if (!Number.isFinite(value) || !Number.isInteger(period) || period <= 0)
    throw new EngineError('E_INVALID_INPUT');
  return ((value % period) + period) % period;
}
/** Sexagenary pair at an integer index, 0 = jia/zi; wraps every 60. */
export function ganZhiAt(index: number): { stem: Stem; branch: Branch } {
  if (!Number.isInteger(index)) throw new EngineError('E_INVALID_INPUT');
  return { stem: STEMS[mod(index, 10)]!, branch: BRANCHES[mod(index, 12)]! };
}
/** Sexagenary index (0–59); rejects impossible stem/branch parity. */
export function ganZhiIndex(stem: Stem, branch: Branch): number {
  const s = STEMS.indexOf(stem),
    b = BRANCHES.indexOf(branch);
  if (s < 0 || b < 0 || s % 2 !== b % 2) throw new EngineError('E_INVALID_INPUT');
  return mod(s + 10 * mod((s - b) / 2, 6), 60);
}
export const SEXAGENARY_CYCLE = Array.from({ length: 60 }, (_, i) => ganZhiAt(i));
/** Five-tiger escape; month branch yin is the first solar month. */
export function fiveTiger(yearStem: Stem, monthBranch: Branch): Stem {
  return STEMS[
    mod((STEMS.indexOf(yearStem) % 5) * 2 + 2 + mod(BRANCHES.indexOf(monthBranch) - 2, 12), 10)
  ]!;
}
/** Five-rat escape; hour branch zi is the first double hour. */
export function fiveRat(dayStem: Stem, hourBranch: Branch): Stem {
  return STEMS[mod((STEMS.indexOf(dayStem) % 5) * 2 + BRANCHES.indexOf(hourBranch), 10)]!;
}
/** Branch for a civil hour (0–23); zi spans 23:00–00:59. */
export function hourBranch(hour: number): Branch {
  if (!Number.isInteger(hour) || hour < 0 || hour > 23) throw new EngineError('E_INVALID_INPUT');
  return BRANCHES[Math.floor((hour + 1) / 2) % 12]!;
}
/** Target stem's ten-god relationship to the day stem. */
export function tenGod(dayStem: Stem, target: Stem): TenGod {
  const delta = mod(
    ELEMENTS.indexOf(STEM_ELEMENTS[target]) - ELEMENTS.indexOf(STEM_ELEMENTS[dayStem]),
    5,
  );
  const same = STEM_YIN_YANG[dayStem] === STEM_YIN_YANG[target];
  const pairs: readonly (readonly [TenGod, TenGod])[] = [
    ['bi_jian', 'jie_cai'],
    ['shi_shen', 'shang_guan'],
    ['pian_cai', 'zheng_cai'],
    ['qi_sha', 'zheng_guan'],
    ['pian_yin', 'zheng_yin'],
  ];
  return pairs[delta]![same ? 0 : 1];
}
export const TEN_GOD_MATRIX = STEMS.map((day) => STEMS.map((target) => tenGod(day, target)));
const naYinPairs = Object.values(NaYin);
export const NA_YIN = SEXAGENARY_CYCLE.map((_, i) => naYinPairs[Math.floor(i / 2)]!);
/** Na-yin key for a valid stem/branch pair. */
export function naYin(stem: Stem, branch: Branch): NaYin {
  return NA_YIN[ganZhiIndex(stem, branch)]!;
}
// Fire and earth share growth origins; yang forward, yin backward (mainstream Ziping).
export const LIFE_STAGE_START: Record<Stem, Branch> = {
  jia: 'hai',
  yi: 'wu',
  bing: 'yin',
  ding: 'you',
  wu_stem: 'yin',
  ji: 'you',
  geng: 'si',
  xin: 'zi',
  ren: 'shen',
  gui: 'mao',
};
/** Twelve-stage key for a day stem and branch. */
export function lifeStage(dayStem: Stem, branch: Branch): LifeStage {
  return LIFE_STAGES[
    mod(
      (BRANCHES.indexOf(branch) - BRANCHES.indexOf(LIFE_STAGE_START[dayStem])) *
        (STEM_YIN_YANG[dayStem] === 'yang' ? 1 : -1),
      12,
    )
  ]!;
}
export const VOID_BRANCHES: readonly (readonly [Branch, Branch])[] = [
  ['xu', 'hai'],
  ['shen', 'you'],
  ['wu', 'wei'],
  ['chen', 'si'],
  ['yin', 'mao'],
  ['zi', 'chou'],
];
/** Xun void pair for a valid day pillar. */
export function voidBranches(stem: Stem, branch: Branch): readonly [Branch, Branch] {
  return VOID_BRANCHES[Math.floor(ganZhiIndex(stem, branch) / 10)]!;
}
