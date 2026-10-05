import { Temporal } from '@js-temporal/polyfill';
import { z } from 'zod';
import {
  BaziChartSchema,
  NormalizedBirthSchema,
  type BaziChart,
  type EngineWarning,
  type NormalizedBirth,
} from '@tianji/shared';
import { EngineError } from '../common/error';
import { STEMS, BRANCHES, STEM_YIN_YANG, voidBranches } from '../common/ganzhi';
import { makePillar } from './pillars';
import {
  birthClock,
  toSolar,
  termFrame,
  termOutput,
  computeLuck,
  computeTransits,
} from './calendar';
import { elementDistribution, assessStrength, selectUseGod, detectPattern } from './analysis';
import { natalRelations } from './relations';
import { computeShenSha } from './shen-sha';
import { computeFeatures } from './features';
export { BaziChartSchema } from '@tianji/shared';
export const BaziSchoolSchema = z
  .object({
    ziHour: z.enum(['zi_unified', 'zi_split']).default('zi_unified'),
    useApparentSolarTime: z.boolean().default(true),
    strengthMethod: z.literal('weighted_v1').default('weighted_v1'),
  })
  .strict();
const optionsSchema = z
  .object({
    school: BaziSchoolSchema.default({}),
    now: z.union([
      z.string(),
      z.instanceof(Temporal.ZonedDateTime),
      z.instanceof(Temporal.Instant),
    ]),
    yearsAround: z.number().int().min(0).max(100).default(10),
  })
  .strict();
export type BaziOptions = z.input<typeof optionsSchema>;
export type BaziSchool = z.infer<typeof BaziSchoolSchema>;
// Required task mapping; see the compatibility adjustment below instead of silently reversing these values.
export const BAZI_SECT = { zi_unified: 2, zi_split: 1 } as const;
/** Computes a schema-validated natal chart from a normalized birth and explicit now; never reads the clock. */
export function computeBazi(rawBirth: NormalizedBirth, rawOptions: BaziOptions): BaziChart {
  const b = NormalizedBirthSchema.safeParse(rawBirth);
  if (!b.success) throw new EngineError('E_INVALID_INPUT');
  const school = BaziSchoolSchema.safeParse(rawOptions.school ?? {});
  if (!school.success) throw new EngineError('E_UNSUPPORTED_SCHOOL');
  const options = optionsSchema.safeParse(rawOptions);
  if (!options.success) throw new EngineError('E_INVALID_INPUT');
  const birth = b.data,
    { now: rawNow, yearsAround } = options.data;
  let now: Temporal.ZonedDateTime;
  try {
    now =
      rawNow instanceof Temporal.ZonedDateTime
        ? rawNow.withTimeZone(birth.local.tz)
        : Temporal.Instant.from(rawNow.toString()).toZonedDateTimeISO(birth.local.tz);
  } catch {
    throw new EngineError('E_INVALID_INPUT');
  }
  const enabled = school.data.useApparentSolarTime && birth.solarTime.local !== null;
  const clock = birthClock(birth, enabled),
    lunar = toSolar(clock).getLunar();
  const eight = lunar.getEightChar();
  eight.setSect(BAZI_SECT[school.data.ziHour]);
  // DESIGN-GAP: 1.8.6 sect 2 keeps today's late-zi day (official 6tail.cn/calendar/lunar.bazi.html), opposite to docs.
  // Preserve required sect mapping; choose Exact (next day) / Exact2 (civil day) explicitly, leaving month/year at the birth instant.
  const dm =
    STEMS[
      school.data.ziHour === 'zi_unified'
        ? lunar.getDayGanIndexExact()
        : lunar.getDayGanIndexExact2()
    ]!;
  const db =
    BRANCHES[
      school.data.ziHour === 'zi_unified'
        ? lunar.getDayZhiIndexExact()
        : lunar.getDayZhiIndexExact2()
    ]!;
  // DESIGN-GAP: Solar time changes the civil day/hour, not the physical instant of a jie crossing.
  const instantClock = Temporal.Instant.from(birth.utc!).toZonedDateTimeISO(birth.local.tz);
  const termLunar = termFrame(instantClock.toPlainDateTime(), birth.local.tz).getLunar();
  const pillars: BaziChart['pillars'] = {
    year: makePillar(
      STEMS[termLunar.getYearGanIndexExact()]!,
      BRANCHES[termLunar.getYearZhiIndexExact()]!,
      dm,
      db,
    ),
    month: makePillar(
      STEMS[termLunar.getMonthGanIndexExact()]!,
      BRANCHES[termLunar.getMonthZhiIndexExact()]!,
      dm,
      db,
    ),
    day: makePillar(dm, db, dm, db, true),
    hour: birth.timeUnknown
      ? null
      : makePillar(STEMS[lunar.getTimeGanIndex()]!, BRANCHES[lunar.getTimeZhiIndex()]!, dm, db),
  };
  const elements = elementDistribution(pillars),
    strength = assessStrength(pillars);
  const useGod = selectUseGod(pillars, strength, elements),
    pattern = detectPattern(pillars, strength);
  const luck = computeLuck(birth, now, pillars);
  const chart: Omit<BaziChart, 'features'> = {
    pillars,
    dayMaster: { stem: dm, element: pillars.day.stemElement, yinYang: STEM_YIN_YANG[dm] },
    elements,
    strength,
    useGod,
    pattern,
    relations: natalRelations(pillars),
    voidBranches: [...voidBranches(dm, db)],
    shenSha: computeShenSha(pillars),
    luck,
    ...computeTransits(now, yearsAround, pillars, luck),
    solarTerms: {
      prevJie: termOutput(termLunar.getPrevJie(), birth.local.tz),
      nextJie: termOutput(termLunar.getNextJie(), birth.local.tz),
    },
    solarTimeAdjust: {
      enabled,
      offsetMinutes: enabled ? birth.solarTime.offsetMinutes : null,
      original: birthClock(birth, false).toString(),
      adjusted: enabled ? clock.toString() : null,
    },
  };
  return BaziChartSchema.parse({ ...chart, features: computeFeatures(chart) });
}
/** Localized warning keys for incomplete time, unspecified gender and tentative extreme patterns. */
export function baziWarnings(birth: NormalizedBirth, chart: BaziChart): EngineWarning[] {
  const warnings: EngineWarning[] = [];
  if (birth.timeUnknown)
    warnings.push({ code: 'W_NO_HOUR_PILLAR', messageKey: 'engine.warnings.W_NO_HOUR_PILLAR' });
  if (birth.gender === 'unspecified')
    warnings.push({ code: 'W_GENDER_DEFAULTED', messageKey: 'engine.warnings.W_GENDER_DEFAULTED' });
  if (chart.features.suspected_cong)
    warnings.push({ code: 'W_SUSPECTED_CONG', messageKey: 'engine.warnings.W_SUSPECTED_CONG' });
  return warnings;
}
