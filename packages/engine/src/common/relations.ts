import type { Branch, BranchRelationType } from '@tianji/shared';
export const BRANCH_COMBINATIONS = [
  ['zi', 'chou'],
  ['yin', 'hai'],
  ['mao', 'xu'],
  ['chen', 'you'],
  ['si', 'shen'],
  ['wu', 'wei'],
] as const;
export const BRANCH_TRINES = [
  ['shen', 'zi', 'chen'],
  ['hai', 'mao', 'wei'],
  ['yin', 'wu', 'xu'],
  ['si', 'you', 'chou'],
] as const;
export const BRANCH_CLASHES = [
  ['zi', 'wu'],
  ['chou', 'wei'],
  ['yin', 'shen'],
  ['mao', 'you'],
  ['chen', 'xu'],
  ['si', 'hai'],
] as const;
export const BRANCH_HARMS = [
  ['zi', 'wei'],
  ['chou', 'wu'],
  ['yin', 'si'],
  ['mao', 'chen'],
  ['shen', 'hai'],
  ['you', 'xu'],
] as const;
export const BRANCH_BREAKS = [
  ['zi', 'you'],
  ['chou', 'chen'],
  ['yin', 'hai'],
  ['mao', 'wu'],
  ['si', 'shen'],
  ['wei', 'xu'],
] as const;
export const BRANCH_PUNISHMENTS = [
  ['yin', 'si', 'shen'],
  ['chou', 'xu', 'wei'],
  ['zi', 'mao'],
] as const;
export const BRANCH_SELF_PUNISHMENTS = ['chen', 'wu', 'you', 'hai'] as const;
export const STEM_COMBINATIONS = [
  ['jia', 'ji'],
  ['yi', 'geng'],
  ['bing', 'xin'],
  ['ding', 'ren'],
  ['wu_stem', 'gui'],
] as const;
export const STEM_CLASHES = [
  ['jia', 'geng'],
  ['yi', 'xin'],
  ['bing', 'ren'],
  ['ding', 'gui'],
] as const;
/** All pair relations; two members of a trine return tri_combine (half combination). */
export function branchRelations(a: Branch, b: Branch): BranchRelationType[] {
  const hit = (groups: readonly (readonly Branch[])[]) =>
    a !== b && groups.some((group) => group.includes(a) && group.includes(b));
  const result: BranchRelationType[] = [];
  if (hit(BRANCH_COMBINATIONS)) result.push('combine');
  // DESIGN-GAP: Pair-level tri_combine denotes half-combination; use branchTrines for a complete triple.
  if (hit(BRANCH_TRINES)) result.push('tri_combine');
  if (hit(BRANCH_CLASHES)) result.push('clash');
  // DESIGN-GAP: Punishment detection is symmetric; direction/strength belong to the system interpretation.
  if (
    hit(BRANCH_PUNISHMENTS) ||
    (a === b && BRANCH_SELF_PUNISHMENTS.some((branch) => branch === a))
  )
    result.push('punish');
  if (hit(BRANCH_HARMS)) result.push('harm');
  if (hit(BRANCH_BREAKS)) result.push('break');
  return result;
}
/** Complete trine triples found in the given branches (duplicates do not imply completion). */
export function branchTrines(branches: readonly Branch[]): readonly (readonly Branch[])[] {
  return BRANCH_TRINES.filter((group) => group.every((branch) => branches.includes(branch)));
}
