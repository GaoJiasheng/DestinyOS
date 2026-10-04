import type { DailyChart } from '@tianji/shared';
import { createRandom } from '../common/random';
export interface DailyActionUnit {
  id: string;
  findings: readonly string[];
  weight: number;
  do: readonly string[];
  dont: readonly string[];
}
// DESIGN-GAP: DailyInput lacks a knowledge bundle. Callers can supply matched KU action keys without reversing engine→interpret/content dependencies; these bilingual defaults fill empty candidates.
const DO = ['listen', 'pause', 'review', 'focus', 'ask', 'rest', 'prepare', 'share', 'notice'];
const DONT = [
  'rush',
  'assume',
  'overpromise',
  'multitask',
  'argue',
  'overwork',
  'compare',
  'interrupt',
  'procrastinate',
];
// DESIGN-GAP: Aliases identify synonymous action keys so KU candidates do not repeat mapped Yi/Ji under a different key.
const ALIASES: Readonly<Record<string, string>> = {
  travel: 'travel',
  romance: 'romance',
  deals: 'deals',
  social: 'social',
  home: 'home',
  changes: 'changes',
  health: 'health',
  grooming: 'grooming',
  reflection: 'reflection',
  new_project: 'new_project',
  roles: 'roles',
  family: 'family',
};
const identity = (key: string): string => ALIASES[key.split('.').at(-1)!] ?? key;
/** Weight first, seed-shuffled ties, no duplicates/conflicts between either list or almanac. */
export function selectDailyActions(
  seed: string,
  findings: readonly string[],
  almanac: DailyChart['bazi']['almanac'],
  units: readonly DailyActionUnit[] = [],
): DailyChart['doDont'] {
  const blocked = new Set([...almanac.yi, ...almanac.ji].map(identity));
  const random = createRandom(`${seed}|actions`);
  const matched = units.filter((unit) =>
    unit.findings.some((finding) => findings.includes(finding)),
  );
  const defaults: DailyActionUnit = {
    id: 'daily.defaults',
    findings: [],
    weight: -1,
    do: DO.map((key) => `daily.actions.${key}`),
    dont: DONT.map((key) => `daily.actions.${key}`),
  };
  const candidates = [...matched, defaults]
    .flatMap((unit) =>
      (['do', 'dont'] as const).flatMap((side) =>
        unit[side].map((key) => ({ side, key, weight: unit.weight, tie: random.next() })),
      ),
    )
    .sort((a, b) => b.weight - a.weight || a.tie - b.tie);
  const result: DailyChart['doDont'] = { do: [], dont: [] };
  for (const candidate of candidates) {
    if (result[candidate.side].length >= 3 || blocked.has(identity(candidate.key))) continue;
    result[candidate.side].push(candidate.key);
    blocked.add(identity(candidate.key));
  }
  return result;
}
