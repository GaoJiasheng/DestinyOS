/** Read-only summary; Vitest owns the acceptance assertions. No oracle JSON is rewritten. */
import births from '../fixtures/xval/births.json';
import casts from '../fixtures/xval/casts.json';
import { computePositions } from '../../src/astrology/ephemeris';
import { computeAngles, computeHouses } from '../../src/astrology/houses';
import { ayanamsaLahiri } from '../../src/astrology/vedic-rules';
import { distance } from '../../src/astrology/math';
import { normalizeBirth } from '../../src/common/normalize-birth';
const maxima: Record<string, { error: number; id: string }> = {};
function record(key: string, error: number, id: string) {
  if (!maxima[key] || maxima[key].error < error) maxima[key] = { error, id };
}
let dstBirths = 0,
  solarCrossDay = 0;
for (const f of births) {
  const j = f.reference.jd;
  const p = computePositions(j, [
    'sun',
    'moon',
    'mercury',
    'venus',
    'mars',
    'jupiter',
    'saturn',
    'uranus',
    'neptune',
    'pluto',
    'north_node',
    'lilith',
  ]);
  for (const [key, v] of Object.entries(p))
    record(
      key,
      distance(v.lon, f.reference.positions[key as keyof typeof f.reference.positions]),
      f.id,
    );
  record(
    'mean_node',
    distance(
      computePositions(j, ['north_node'], { node: 'mean' }).north_node.lon,
      f.reference.positions.mean_node,
    ),
    f.id,
  );
  record('lahiri', distance(ayanamsaLahiri(j), f.reference.ayanamsa), f.id);
  const a = computeAngles(j, f.input.place.lat, f.input.place.lng);
  record('asc', distance(a.asc, f.reference.houses.whole_sign.asc), f.id);
  record('mc', distance(a.mc, f.reference.houses.whole_sign.mc), f.id);
  for (const system of ['placidus', 'whole_sign'] as const)
    computeHouses(system, a.asc, a.mc, f.input.place.lat, a.obliquity).forEach((c, i) =>
      record(system, distance(c, f.reference.houses[system].cusps[i]!), f.id),
    );
  const b = normalizeBirth(f.input);
  dstBirths += Number(b.warnings.some((w) => w.code === 'W_DST_PERIOD'));
  solarCrossDay += Number(b.solarTime.local !== null && b.solarTime.local.day !== b.local.day);
}
console.log(
  JSON.stringify(
    {
      births: births.length,
      dstBirths,
      solarCrossDay,
      unknownTime: births.filter((f) => f.input.timeUnknown).length,
      maxAngularErrorDegrees: maxima,
      qimenRawJuDifferences: casts.filter((f) => f.kinqimenRaw.排局 !== f.kinqimenDocumentedJu.排局)
        .length,
      referenceSkyFaults: {
        clocks: 2,
        stems: 16,
        verifiedBy: 'docs §3.5 star-carried earth-stem invariant, xval.test.ts',
      },
    },
    null,
    2,
  ),
);
