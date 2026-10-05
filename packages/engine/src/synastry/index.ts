import {
  SynastryChartSchema,
  NormalizedBirthSchema,
  Aspect,
  type NormalizedBirth,
  type BaziChart,
  type AstroChart,
  type ZiweiChart,
  type SynastryChart,
  type TenGod,
} from '@tianji/shared';
import { computeBazi } from '../bazi';
import { computeZiwei } from '../ziwei';
import { computeAstrology, computeVedic } from '../astrology';
import { tenGod, ELEMENTS } from '../common/ganzhi';
import { STEM_COMBINATIONS, STEM_CLASHES, branchRelations } from '../common/relations';
import { DEFAULT_ORBS, ASPECT_ANGLES } from '../astrology/aspects';
import { computeAshtakoot } from './ashtakoot';
import { EngineError } from '../common/error';
export * from './ashtakoot';
/** Cross-chart major aspects, including same-planet pairs; no temporal applying/separating claim across two birth instants. */
export function crossAspects(a: AstroChart, b: AstroChart): SynastryChart['western']['aspects'] {
  // DESIGN-GAP: Reuse natal major-aspect orbs with one luminary allowance; separate birth instants have no applying flag.
  const result: SynastryChart['western']['aspects'] = [];
  for (const pa of a.bodies)
    for (const pb of b.bodies) {
      const difference = Math.abs(pa.lon - pb.lon),
        separation = Math.min(difference, 360 - difference);
      for (const type of [
        Aspect.conjunction,
        Aspect.sextile,
        Aspect.square,
        Aspect.trine,
        Aspect.opposition,
      ]) {
        const orb = Math.abs(separation - ASPECT_ANGLES[type]);
        if (
          orb <=
          DEFAULT_ORBS[type] +
            ([pa.key, pb.key].some((k) => k === 'sun' || k === 'moon') ? 2 : 0) +
            1e-10
        )
          result.push({ a: pa.key, b: pb.key, type, orb, separation });
      }
    }
  return result.sort((x, y) => x.orb - y.orb);
}
/** Place each source planet in the target's cusps; missing target birth time/place produces no invented houses. */
export function crossHouses(a: AstroChart, b: AstroChart): SynastryChart['western']['overlays'] {
  // DESIGN-GAP: Target cusps form left-closed, right-open circular intervals; unavailable houses stay absent.
  const result: SynastryChart['western']['overlays'] = [];
  for (const [from, source, target] of [
    ['a', a, b],
    ['b', b, a],
  ] as const) {
    if (!target.houses) continue;
    for (const p of source.bodies) {
      const house = target.houses.find((h, i) => {
        const next = target.houses![(i + 1) % 12]!.cusp;
        return (p.lon - h.cusp + 360) % 360 < (next - h.cusp + 360) % 360;
      });
      if (house) result.push({ from, planet: p.key, house: house.index });
    }
  }
  return result;
}
/** Transparent Bazi comparison: no invented fate percentage; complementarity measures distribution diversity and favorable support separately. */
export function compareBazi(
  a: BaziChart,
  b: BaziChart,
  genders: [NormalizedBirth['gender'], NormalizedBirth['gender']],
): SynastryChart['bazi'] {
  const stemPair = [a.dayMaster.stem, b.dayMaster.stem];
  const dayStemRelations: SynastryChart['bazi']['dayStemRelations'] = [];
  if (STEM_COMBINATIONS.some((pair) => pair.every((s) => stemPair.includes(s))))
    dayStemRelations.push('combine');
  if (STEM_CLASHES.some((pair) => pair.every((s) => stemPair.includes(s))))
    dayStemRelations.push('clash');
  const interactions: SynastryChart['bazi']['tenGodInteractions'] = [],
    spouseStars: SynastryChart['bazi']['spouseStars'] = [];
  for (const [observer, source, target, gender] of [
    ['a', a, b, genders[0]],
    ['b', b, a, genders[1]],
  ] as const) {
    // DESIGN-GAP: Classical wealth/officer spouse-star rules are descriptive; unspecified gender shows both sets without assigning a relationship role.
    const expected: TenGod[] =
      gender === 'male'
        ? ['zheng_cai', 'pian_cai']
        : gender === 'female'
          ? ['zheng_guan', 'qi_sha']
          : ['zheng_cai', 'pian_cai', 'zheng_guan', 'qi_sha'];
    const matches: SynastryChart['bazi']['spouseStars'][number]['matches'] = [];
    for (const pillar of ['year', 'month', 'day', 'hour'] as const) {
      const p = target.pillars[pillar];
      if (!p) continue;
      const stemGod = tenGod(source.dayMaster.stem, p.stem),
        hiddenGods = p.hiddenStems.map((s) => tenGod(source.dayMaster.stem, s.stem));
      interactions.push({ observer, pillar, stemGod, hiddenGods });
      if ([stemGod, ...hiddenGods].some((g) => expected.includes(g))) matches.push(pillar);
    }
    spouseStars.push({ observer, expected, matches });
  }
  // DESIGN-GAP: Total variation distance of the five-element percentages is the complementarity index (0=same distribution,100=disjoint); never a relationship success score.
  const elementComplementarity =
    ELEMENTS.reduce((s, e) => s + Math.abs(a.elements.pct[e] - b.elements.pct[e]), 0) / 2;
  return {
    dayStemRelations,
    dayBranchRelations: branchRelations(a.pillars.day.branch, b.pillars.day.branch),
    yearRelations: branchRelations(a.pillars.year.branch, b.pillars.year.branch),
    elementComplementarity: Math.min(100, elementComplementarity),
    favorableSupport: [
      Math.min(
        100,
        a.useGod.favorable.reduce((s, e) => s + b.elements.pct[e], 0),
      ),
      Math.min(
        100,
        b.useGod.favorable.reduce((s, e) => s + a.elements.pct[e], 0),
      ),
    ],
    complementaryElements: ELEMENTS.filter(
      (e) =>
        (a.elements.pct[e] < 10 && b.elements.pct[e] >= 10) ||
        (b.elements.pct[e] < 10 && a.elements.pct[e] >= 10),
    ),
    tenGodInteractions: interactions,
    spouseStars,
  };
}
/** Overlay each native annual-stem's natal transformations on matching stars in the other chart's life/spouse triangles. */
export function compareZiwei(a: ZiweiChart, b: ZiweiChart): NonNullable<SynastryChart['ziwei']> {
  // DESIGN-GAP: Cross-chart transformations use same-star natal positions, with 0/4/6/8 life/spouse triangle offsets.
  const transformations: NonNullable<SynastryChart['ziwei']>['transformations'] = [];
  for (const [from, source, target] of [
    ['a', a, b],
    ['b', b, a],
  ] as const) {
    const life = target.palaces.find((p) => p.key === 'life')!,
      spouse = target.palaces.find((p) => p.key === 'spouse')!;
    const inTriangle = (index: number, root: number) =>
      [0, 4, 6, 8].includes((index - root + 12) % 12);
    for (const palace of source.palaces)
      for (const star of [...palace.majorStars, ...palace.minorStars]) {
        if (!star.mutagen) continue;
        for (const t of target.palaces)
          if ([...t.majorStars, ...t.minorStars].some((s) => s.key === star.key))
            transformations.push({
              from,
              mutagen: star.mutagen,
              star: star.key,
              target: t.key,
              inLifeTriangle: inTriangle(t.index, life.index),
              inSpouseTriangle: inTriangle(t.index, spouse.index),
            });
      }
  }
  return {
    comparisons: (['life', 'spouse'] as const).map((palace) => ({
      palace,
      a: a.palaces.find((p) => p.key === palace)!.majorStars.map((s) => s.key),
      b: b.palaces.find((p) => p.key === palace)!.majorStars.map((s) => s.key),
    })),
    transformations,
  };
}
/** Compute the four paired traditions from two normalized births and a caller-provided ISO instant. */
export function computeSynastry(
  a: NormalizedBirth,
  b: NormalizedBirth,
  now: string,
): SynastryChart {
  if (!NormalizedBirthSchema.safeParse(a).success || !NormalizedBirthSchema.safeParse(b).success)
    throw new EngineError('E_INVALID_INPUT');
  const natal = (birth: NormalizedBirth) => ({
    bazi: computeBazi(birth, { now, yearsAround: 0 }),
    ziwei: birth.timeUnknown ? null : computeZiwei({ birth, now }),
    astrology: computeAstrology(birth),
    vedic: computeVedic(birth, now),
  });
  const first = natal(a),
    second = natal(b),
    aspects = crossAspects(first.astrology, second.astrology);
  const intimate = new Set(['sun', 'moon', 'venus', 'mars']);
  return SynastryChartSchema.parse({
    a: first,
    b: second,
    bazi: compareBazi(first.bazi, second.bazi, [a.gender, b.gender]),
    ziwei: first.ziwei && second.ziwei ? compareZiwei(first.ziwei, second.ziwei) : null,
    western: {
      aspects,
      intimateAspects: aspects.filter((e) => intimate.has(e.a) && intimate.has(e.b)),
      overlays: crossHouses(first.astrology, second.astrology),
    },
    ashtakoot: computeAshtakoot(
      first.vedic.bodies.find((p) => p.key === 'chandra')!.sidLon,
      second.vedic.bodies.find((p) => p.key === 'chandra')!.sidLon,
      a.timeUnknown || b.timeUnknown,
    ),
    availability: {
      ziwei: !!first.ziwei && !!second.ziwei,
      housesA: !!first.astrology.houses,
      housesB: !!second.astrology.houses,
      complete: !a.timeUnknown && !b.timeUnknown,
    },
  });
}
