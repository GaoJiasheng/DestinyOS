import { type BaziChart, type Branch, type Stem } from '@tianji/shared';
import { BRANCHES, computeBazi, normalizeBirth, STEM_YIN_YANG, STEMS } from '../src';
import {
  assessStrength,
  detectPattern,
  elementDistribution,
  selectUseGod,
} from '../src/bazi/analysis';
import { computeFeatures } from '../src/bazi/features';
import { makePillar } from '../src/bazi/pillars';
import { natalRelations } from '../src/bazi/relations';
import { computeShenSha } from '../src/bazi/shen-sha';
import A from './fixtures/bazi/A.json';
import BCS from './fixtures/bazi/B-clock-split.json';
import BC from './fixtures/bazi/B-clock.json';
import BS from './fixtures/bazi/B-split.json';
import B from './fixtures/bazi/B.json';
import C from './fixtures/bazi/C.json';
import D from './fixtures/bazi/D.json';
import E from './fixtures/bazi/E.json';
import GS from './fixtures/bazi/G-split.json';
import G from './fixtures/bazi/G.json';
/** Shared bazi fixture setup for the split regression suites. */
export const now = A.now;
/** Render one fixture pillar using the canonical stem/branch order.
 * @param p Pillar identifiers from shared enums. */
export const chars = (p: { stem: Stem; branch: Branch }) =>
  '甲乙丙丁戊己庚辛壬癸'[STEMS.indexOf(p.stem)]! +
  '子丑寅卯辰巳午未申酉戌亥'[BRANCHES.indexOf(p.branch)]!;
/** Shared bazi fixture setup for the split regression suites. */
export const fixtures = [A, B, BS, BC, BCS, C, D, E, G, GS];
/** Build ordered synthetic pillars with day-master ten-god relationships.
 * @param pairs Year, month, day and optional hour stem/branch pairs. */
export function synthetic(pairs: readonly (readonly [Stem, Branch])[]): BaziChart['pillars'] {
  const [dm, db] = pairs[2]!;
  const ps = pairs.map(([s, b], i) => makePillar(s, b, dm, db, i === 2));
  return { year: ps[0]!, month: ps[1]!, day: ps[2]!, hour: ps[3] ?? null };
}
/** Build an analysis fixture from synthetic pillars and the fixed reference birth.
 * @param pairs Year, month, day and optional hour stem/branch pairs. */
export function sample(pairs: readonly (readonly [Stem, Branch])[]): BaziChart {
  const pillars = synthetic(pairs),
    elements = elementDistribution(pillars),
    strength = assessStrength(pillars);
  const partial = {
    ...computeBazi(normalizeBirth(A.input), { now }),
    pillars,
    dayMaster: {
      stem: pillars.day.stem,
      element: pillars.day.stemElement,
      yinYang: STEM_YIN_YANG[pillars.day.stem],
    },
    elements,
    strength,
    useGod: selectUseGod(pillars, strength, elements),
    pattern: detectPattern(pillars, strength),
    relations: natalRelations(pillars),
    shenSha: computeShenSha(pillars),
  };
  return { ...partial, features: computeFeatures(partial) };
}
