import type { BaziChart, Branch, BranchRelation, PillarKey } from '@tianji/shared';
import {
  branchRelations,
  BRANCH_TRINES,
  STEM_COMBINATIONS,
  STEM_CLASHES,
} from '../common/relations';
import { pillarEntries } from './pillars';
/** All pair relations plus complete three-branch combinations, with named pillar evidence. */
export function natalRelations(pillars: BaziChart['pillars']): BaziChart['relations'] {
  const entries = pillarEntries(pillars);
  const result: BaziChart['relations'] = { stems: [], branches: [] };
  entries.forEach(([a, p], i) =>
    entries.slice(i + 1).forEach(([b, q]) => {
      for (const [type, table] of [
        ['combine', STEM_COMBINATIONS],
        ['clash', STEM_CLASHES],
      ] as const)
        if (
          p.stem !== q.stem &&
          table.some((pair) => pair.some((s) => s === p.stem) && pair.some((s) => s === q.stem))
        )
          result.stems.push({ type, pillars: [a, b], stems: [p.stem, q.stem] });
      result.branches.push(...pairRelations(a, p.branch, b, q.branch));
    }),
  );
  for (const group of BRANCH_TRINES) {
    // Enumerate all pillar triples, including alternate instances of a repeated branch.
    for (let i = 0; i < entries.length; i++)
      for (let j = i + 1; j < entries.length; j++)
        for (let k = j + 1; k < entries.length; k++) {
          const triple = [entries[i]!, entries[j]!, entries[k]!];
          if (group.every((b) => triple.some(([, p]) => p.branch === b)))
            result.branches.push({
              type: 'tri_combine',
              pillars: triple.map(([key]) => key),
              branches: triple.map(([, p]) => p.branch),
              complete: true,
            });
        }
  }
  return result;
}
/** Pair relation evidence; tri_combine with complete=false denotes a half trine. */
export function pairRelations(a: string, x: Branch, b: string, y: Branch): BranchRelation[] {
  return branchRelations(x, y).map((type) => ({
    type,
    pillars: [a, b],
    branches: [x, y],
    complete: type !== 'tri_combine',
  }));
}
/** Relations between a transit branch and each natal pillar. */
export function transitRelations(
  branch: Branch,
  pillars: BaziChart['pillars'],
  key = 'year_transit',
): BranchRelation[] {
  return pillarEntries(pillars).flatMap(([p, n]) =>
    pairRelations(key, branch, p as PillarKey, n.branch),
  );
}
