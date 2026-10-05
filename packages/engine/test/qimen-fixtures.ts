import { QimenChartSchema, Stem, type QimenPalace } from '@tianji/shared';
import { readdirSync, readFileSync } from 'node:fs';
import { z } from 'zod';
import { computeQimen, type QimenInput } from '../src/qimen';
/** Shared qimen fixture setup for the split regression suites. */
export const options = {
  school: {
    layout: 'rotating',
    juMethod: 'chaibu',
    centerLodge: 'kun2',
    useApparentSolarTime: false,
  },
} as const;
/** Cast a reference Qimen chart using the fixed rotating school.
 * @param at ISO time with explicit IANA timezone.
 * @param category Documented Qimen question category. */
export const cast = (at: string, category: QimenInput['category'] = 'general') =>
  computeQimen({ at, category, options });
/** Shared qimen fixture setup for the split regression suites. */
export const directory = 'packages/engine/test/fixtures/qimen-baseline';
/** Shared qimen fixture setup for the split regression suites. */
export const fixtureSchema = z.object({
  at: z.string(),
  raw: z.record(z.unknown()),
  documented: QimenChartSchema.pick({
    pillars: true,
    dun: true,
    ju: true,
    solarTerm: true,
    xunShou: true,
    zhiFu: true,
    zhiShi: true,
  }).extend({
    palaces: z.array(
      z.object({
        index: z.number(),
        earthStem: z.nativeEnum(Stem),
        skyStem: z.nativeEnum(Stem),
        star: z.string(),
        gate: z.string().nullable(),
        deity: z.string().nullable(),
        hiddenStem: z.nativeEnum(Stem).optional(),
      }),
    ),
  }),
});
/** Shared qimen fixture setup for the split regression suites. */
export const fixtures = readdirSync(directory)
  .filter((f) => f.endsWith('.json'))
  .map((f) => fixtureSchema.parse(JSON.parse(readFileSync(`${directory}/${f}`, 'utf8'))));
/** Shared qimen fixture setup for the split regression suites. */
export const palace: QimenPalace = {
  index: 1,
  trigram: 'kan',
  direction: 'north',
  earthStem: 'yi',
  skyStem: 'bing',
  star: 'tian_peng',
  gate: 'xiu',
  deity: 'zhi_fu',
  flags: [],
  patterns: [],
};
