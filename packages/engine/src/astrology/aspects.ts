import { Aspect, Planet, type AstroAspect, type AstroChart, type Body } from '@tianji/shared';
import { type Position } from './ephemeris';
import { signed } from './math';
export const ASPECT_ANGLES: Record<Aspect, number> = {
  conjunction: 0,
  sextile: 60,
  square: 90,
  trine: 120,
  opposition: 180,
  semisextile: 30,
  semisquare: 45,
  sesquiquadrate: 135,
  quincunx: 150,
};
// DESIGN-GAP: Minor aspects have 2° orbs; the luminary +2° bonus applies once per pair to major aspects only.
export const DEFAULT_ORBS: Record<Aspect, number> = {
  conjunction: 8,
  sextile: 5,
  square: 7,
  trine: 7,
  opposition: 8,
  semisextile: 2,
  semisquare: 2,
  sesquiquadrate: 2,
  quincunx: 2,
};
const major = new Set<Aspect>([
  Aspect.conjunction,
  Aspect.sextile,
  Aspect.square,
  Aspect.trine,
  Aspect.opposition,
]);
/** Detect nine aspects, orb degrees inclusive, applying from signed relative angular velocity (exact/stationary is false). */
export function aspects(
  positions: Partial<Record<Body, Position>>,
  orbs: Partial<Record<Aspect, number>> = {},
): AstroAspect[] {
  const keys = Object.keys(positions) as Body[],
    result: AstroAspect[] = [];
  for (let i = 0; i < keys.length; i++)
    for (let j = i + 1; j < keys.length; j++) {
      const a = keys[i]!,
        b = keys[j]!,
        pa = positions[a]!,
        pb = positions[b]!,
        delta = signed(pb.lon - pa.lon),
        separation = Math.abs(delta);
      for (const type of Object.values(Aspect)) {
        const isMajor = major.has(type),
          orb = Math.abs(separation - ASPECT_ANGLES[type]);
        const limit =
          (orbs[type] ?? DEFAULT_ORBS[type]) +
          (isMajor && [a, b].some((k) => k === Planet.sun || k === Planet.moon) ? 2 : 0);
        if (orb <= limit + 1e-10) {
          const target = (delta < 0 ? -1 : 1) * ASPECT_ANGLES[type],
            error = signed(delta - target);
          result.push({
            a,
            b,
            type,
            orb,
            applying: error * (pb.speed - pa.speed) < 0,
            major: isMajor,
          });
        }
      }
    }
  return result.sort((a, b) => a.orb - b.orb);
}
/** Detect graph-defined grand trine, T-square, grand cross, kite and Yod; return each body set once. */
export function aspectPatterns(edges: readonly AstroAspect[]): AstroChart['patterns'] {
  const keys = [...new Set(edges.flatMap((e) => [e.a, e.b]))],
    result: AstroChart['patterns'] = [],
    seen = new Set<string>();
  const has = (a: Body, b: Body, t: Aspect) =>
    edges.some((e) => e.type === t && ((e.a === a && e.b === b) || (e.b === a && e.a === b)));
  const add = (key: AstroChart['patterns'][number]['key'], bodies: Body[]) => {
    const sorted = [...bodies].sort(),
      id = key + sorted.join(',');
    if (!seen.has(id)) {
      seen.add(id);
      result.push({ key, bodies: sorted });
    }
  };
  for (const a of keys)
    for (const b of keys.filter((k) => k !== a))
      for (const c of keys.filter((k) => k !== a && k !== b)) {
        const triangle =
          has(a, b, Aspect.trine) && has(b, c, Aspect.trine) && has(c, a, Aspect.trine);
        if (triangle) {
          add('grand_trine', [a, b, c]);
          for (const d of keys.filter((k) => ![a, b, c].includes(k)))
            if (
              has(d, a, Aspect.opposition) &&
              has(d, b, Aspect.sextile) &&
              has(d, c, Aspect.sextile)
            )
              add('kite', [a, b, c, d]);
        }
        if (has(a, b, Aspect.opposition) && has(c, a, Aspect.square) && has(c, b, Aspect.square)) {
          add('t_square', [a, b, c]);
          for (const d of keys.filter((k) => ![a, b, c].includes(k)))
            if (
              has(c, d, Aspect.opposition) &&
              has(d, a, Aspect.square) &&
              has(d, b, Aspect.square)
            )
              add('grand_cross', [a, b, c, d]);
        }
        if (has(a, b, Aspect.sextile) && has(a, c, Aspect.quincunx) && has(b, c, Aspect.quincunx))
          add('yod', [a, b, c]);
      }
  return result;
}
