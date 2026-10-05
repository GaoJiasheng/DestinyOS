import type { Branch, Element, Stem, DailyChart } from '@tianji/shared';
import { BRANCHES, STEM_ELEMENTS, fiveRat } from '../common/ganzhi';
import { branchRelations } from '../common/relations';
import { createRandom } from '../common/random';
// DESIGN-GAP: Concrete shades/HEX values are conventional sRGB choices; all display names are next-intl keys.
export const COLOR_FAMILIES = {
  wood: [
    ['teal', '#008080'],
    ['emerald', '#50C878'],
    ['mint', '#98FF98'],
  ],
  fire: [
    ['vermilion', '#E34234'],
    ['orange', '#FFA500'],
    ['rose', '#FF007F'],
  ],
  earth: [
    ['yellow', '#FFD700'],
    ['brown', '#8B4513'],
    ['beige', '#F5F5DC'],
  ],
  metal: [
    ['white', '#FFFFFF'],
    ['silver', '#C0C0C0'],
    ['gold', '#D4AF37'],
  ],
  water: [
    ['black', '#000000'],
    ['navy', '#000080'],
    ['blue', '#0000FF'],
  ],
} as const;
export const LUCKY_NUMBERS: Record<Element, [number, number]> = {
  water: [1, 6],
  fire: [2, 7],
  wood: [3, 8],
  metal: [4, 9],
  earth: [5, 10],
};
// DESIGN-GAP: Earth uses the documented southwest alternative, represented as a translation key.
export const DAILY_DIRECTIONS: Record<Element, string> = {
  wood: 'daily.direction.east',
  fire: 'daily.direction.south',
  earth: 'daily.direction.southwest',
  metal: 'daily.direction.west',
  water: 'daily.direction.north',
};
/** Select a stable sRGB color and translation key from an elemental family.
 * @param element Favorable natal element.
 * @param seed Caller-provided deterministic daily seed. */
export function luckyColor(element: Element, seed: string) {
  const family = COLOR_FAMILIES[element];
  const [name, hex] = family[Math.floor(createRandom(`${seed}|color`).next() * family.length)]!;
  return { name: `daily.color.${name}`, hex };
}
/** Favorable hour ten-gods are derived by projecting the natal favorable elements onto hour stems. */
export function goodHours(
  dayStem: Stem,
  dayBranch: Branch,
  favorable: readonly Element[],
): DailyChart['bazi']['goodHours'] {
  // DESIGN-GAP: Favorable ten-gods are those whose stem elements are natal favorable; select in branch order, then fill any shortfall from non-clashing hours.
  const safe = BRANCHES.filter((branch) => !branchRelations(branch, dayBranch).includes('clash'));
  const selected = safe.filter((branch) =>
    favorable.includes(STEM_ELEMENTS[fiveRat(dayStem, branch)]),
  );
  for (const branch of safe)
    if (selected.length < 2 && !selected.includes(branch)) selected.push(branch);
  // DESIGN-GAP: Zi is a wrapped 23:00–01:00 interval; endpoints are exclusive, all times in the target timezone.
  return selected.slice(0, 2).map((branch) => {
    const i = BRANCHES.indexOf(branch);
    return {
      branch,
      from: `${String((i * 2 + 23) % 24).padStart(2, '0')}:00`,
      to: `${String((i * 2 + 1) % 24).padStart(2, '0')}:00`,
    };
  });
}
/** Return branches combining with the daily branch, preserving canonical branch order.
 * @param dayBranch Daily terrestrial branch. */
export function nobleZodiac(dayBranch: Branch): Branch[] {
  return BRANCHES.filter((branch) =>
    branchRelations(dayBranch, branch).some((type) => type === 'combine' || type === 'tri_combine'),
  );
}
/** Strict §6 whitelist. Chinese strings are library lookup tokens, never emitted as display copy. */
export const ALMANAC_MAPPING: Readonly<Record<string, string>> = {
  出行: 'travel',
  嫁娶: 'romance',
  开市: 'deals',
  交易: 'deals',
  立券: 'deals',
  纳财: 'deals',
  会亲友: 'social',
  入宅: 'home',
  移徙: 'home',
  安床: 'home',
  动土: 'changes',
  修造: 'changes',
  拆卸: 'changes',
  求医: 'health',
  治病: 'health',
  理发: 'grooming',
  沐浴: 'grooming',
  祈福: 'reflection',
  祭祀: 'reflection',
  开光: 'reflection',
  栽种: 'new_project',
  赴任: 'roles',
  求嗣: 'family',
};
/** Map library almanac tokens to deduplicated modern activity translation keys.
 * @param words Library Chinese lookup tokens; unlisted activities are omitted. */
export function mapAlmanac(words: readonly string[]): string[] {
  return [
    ...new Set(
      words.flatMap((word) => {
        const key = ALMANAC_MAPPING[word];
        return key ? [`daily.almanac.${key}`] : [];
      }),
    ),
  ];
}
