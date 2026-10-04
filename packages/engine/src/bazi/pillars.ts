import type { Stem, Branch, Pillar, PillarKey, BaziChart } from '@tianji/shared';
import {
  BRANCH_ELEMENTS,
  STEM_ELEMENTS,
  HIDDEN_STEMS,
  tenGod,
  naYin,
  lifeStage,
  voidBranches,
} from '../common/ganzhi';
export const PILLAR_KEYS: readonly PillarKey[] = ['year', 'month', 'day', 'hour'];
export const HIDDEN_WEIGHTS = [1, 0.5, 0.3] as const;
/** Builds a pillar with all derived keys relative to the selected day stem; uses day-xun voids. */
export function makePillar(
  stem: Stem,
  branch: Branch,
  dayStem: Stem,
  dayBranch: Branch,
  isDay = false,
): Pillar {
  return {
    stem,
    branch,
    stemElement: STEM_ELEMENTS[stem],
    branchElement: BRANCH_ELEMENTS[branch],
    hiddenStems: HIDDEN_STEMS[branch].map((s, i) => ({
      stem: s,
      role: (['main', 'middle', 'residual'] as const)[i]!,
      tenGod: tenGod(dayStem, s),
    })),
    tenGod: isDay ? 'day_master' : tenGod(dayStem, stem),
    naYin: naYin(stem, branch),
    lifeStage: lifeStage(dayStem, branch),
    isVoid: voidBranches(dayStem, dayBranch).includes(branch),
  };
}
/** Present natal pillars, preserving chronological order and omitting an unknown hour. */
export function pillarEntries(pillars: BaziChart['pillars']): [PillarKey, Pillar][] {
  return PILLAR_KEYS.flatMap((key) => {
    const p = pillars[key];
    return p ? [[key, p] as [PillarKey, Pillar]] : [];
  });
}
