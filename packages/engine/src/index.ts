import { Temporal } from '@js-temporal/polyfill';
import { z } from 'zod';
import {
  System,
  NormalizedBirthSchema,
  EngineResultSchema,
  BaziChartSchema,
  ZiweiChartSchema,
  IchingChartSchema,
  QimenChartSchema,
  TarotChartSchema,
  AstrologyChartSchema,
  VedicChartSchema,
  DailyChartSchema,
  SpreadKeySchema,
  CategorySchema,
  type EngineResult,
  type EngineWarning,
} from '@tianji/shared';
import { EngineError } from './common/error';
import { computeZiwei, ZIWEI_SCHOOL_DEFAULTS, type ZiweiSchool } from './ziwei';
import { computeTarot } from './tarot';
import { version } from '../package.json';
import { computeIching, IchingInputSchema } from './iching';
import { computeQimen, QimenInputSchema } from './qimen';
import { parseInput } from './common/divination';
export * from './iching';
export * from './qimen';
export * from './common';
export * from './bazi';
import { computeBazi, BaziSchoolSchema, baziWarnings } from './bazi';
export * from './ziwei';
export * from './tarot';
export * from './astrology';
export * from './daily';
import { computeDaily, dailyDateAt } from './daily';
// DESIGN-GAP: Both Ziwei and Qimen define detectPatterns; preserve Ziwei's earlier root API and expose the Qimen variant by a qualified alias.
export { detectPatterns } from './ziwei';
export { detectPatterns as detectQimenPatterns } from './qimen';
import { computeAstrology, computeVedic, YOGA_CONDITIONS } from './astrology';
export const ENGINE_VERSION = version;
const chartSchemas = {
  bazi: BaziChartSchema,
  ziwei: ZiweiChartSchema,
  iching: IchingChartSchema,
  qimen: QimenChartSchema,
  tarot: TarotChartSchema,
  astrology: AstrologyChartSchema,
  vedic: VedicChartSchema,
  daily: DailyChartSchema,
};
const requestSchema = z
  .object({
    system: z.nativeEnum(System),
    birth: NormalizedBirthSchema.nullable().optional(),
    options: z
      .object({
        school: z.record(z.union([z.string(), z.number().finite(), z.boolean()])).optional(),
        yearsAround: z.number().int().min(0).max(100).optional(),
      })
      .strict()
      .optional(),
    now: z.union([
      z.string(),
      z.instanceof(Temporal.ZonedDateTime),
      z.instanceof(Temporal.Instant),
    ]),
    question: z.record(z.unknown()).optional(),
    seed: z.string().optional(),
    spread: SpreadKeySchema.optional(),
    category: CategorySchema.optional(),
    allowReversed: z.boolean().optional(),
    pickedIndices: z.array(z.number().int()).optional(),
  })
  .strict();
export type ComputeInput = z.infer<typeof requestSchema>;
// DESIGN-GAP: 04 requires explicit now and overrides the clock-reading default illustrated in 09.
/** Uniform synchronous system dispatch; now is caller-provided ISO instant or Temporal time (never reads the clock). */
export function compute(raw: ComputeInput): EngineResult {
  const parsed = requestSchema.safeParse(raw);
  if (!parsed.success)
    throw new EngineError('E_INVALID_INPUT', undefined, {
      issues: parsed.error.issues.map(({ code, path }) => ({ code, path })),
    });
  const input = parsed.data;
  let computedAt: string;
  try {
    computedAt = Temporal.Instant.from(input.now.toString()).toString();
  } catch {
    if (input.now instanceof Temporal.ZonedDateTime) computedAt = input.now.toInstant().toString();
    else throw new EngineError('E_INVALID_INPUT');
  }
  if (
    !['bazi', 'ziwei', 'iching', 'qimen', 'astrology', 'vedic'].includes(input.system) &&
    Object.keys(input.options?.school ?? {}).length
  )
    throw new EngineError('E_UNSUPPORTED_SCHOOL');
  const birth = input.system === 'tarot' ? null : (input.birth ?? null);
  if (['bazi', 'ziwei', 'astrology', 'vedic', 'daily'].includes(input.system) && !birth)
    throw new EngineError('E_INVALID_INPUT');
  if (input.system === 'ziwei' && birth?.timeUnknown)
    throw new EngineError('E_REQUIRES_BIRTH_TIME');
  if (input.system === 'bazi' && birth) {
    if (!BaziSchoolSchema.safeParse(input.options?.school ?? {}).success)
      throw new EngineError('E_UNSUPPORTED_SCHOOL');
    const chart = computeBazi(birth, {
      now: input.now,
      school: BaziSchoolSchema.parse(input.options?.school ?? {}),
      yearsAround: input.options?.yearsAround,
    });
    const school = BaziSchoolSchema.parse(input.options?.school ?? {});
    return EngineResultSchema.parse({
      system: 'bazi',
      engineVersion: ENGINE_VERSION,
      computedAt,
      input: birth,
      chart,
      meta: {
        schoolUsed: school,
        warnings: [...birth.warnings, ...baziWarnings(birth, chart)],
        debug: {
          childhoodBefore: chart.luck.startDate,
          monthAgeBasis: 'chronological',
          // DESIGN-GAP: §6 has only one age pair; professional debug carries the parallel nominal (虚岁) year bounds.
          nominalAges: chart.luck.periods.map((p) => ({
            index: p.index,
            fromAge: p.fromYear - birth.local.year + 1,
            toAge: p.toYear - birth.local.year + 1,
          })),
          stemTransformation: false,
        },
      },
    });
  }
  const warnings: EngineWarning[] = [...(birth?.warnings ?? [])];
  if (birth?.timeUnknown && ['astrology', 'vedic'].includes(input.system))
    warnings.push({ code: 'W_NOON_CHART', messageKey: 'engine.warnings.W_NOON_CHART' });
  let chart: Record<string, unknown> = {};
  let schoolUsed: Record<string, string | number | boolean> = {};
  if (input.system === 'ziwei') {
    chart = computeZiwei({
      birth: birth!,
      now: input.now,
      options: { school: input.options?.school as ZiweiSchool | undefined },
    });
    schoolUsed = { ...ZIWEI_SCHOOL_DEFAULTS, ...input.options?.school, algorithm: 'default' };
    // DESIGN-GAP: Echo the unspecified-gender layout choice in metadata.
    if (birth!.gender === 'unspecified') schoolUsed.genderLayout = 'male';
  } else if (input.system === 'tarot') {
    // DESIGN-GAP: Divination fields follow 07 §createReadingAction; question.text carries the private question.
    if (!input.seed) throw new EngineError('E_INVALID_INPUT');
    if (
      input.question &&
      (Object.keys(input.question).some((key) => key !== 'text') ||
        typeof input.question.text !== 'string')
    )
      throw new EngineError('E_INVALID_INPUT');
    chart = computeTarot({
      seed: input.seed,
      spread: input.spread,
      category: input.category,
      allowReversed: input.allowReversed,
      pickedIndices: input.pickedIndices,
      question: input.question?.text as string | undefined,
    });
    schoolUsed = { deck: 'rws', allowReversed: chart.allowReversed as boolean };
  }
  const now =
    input.now instanceof Temporal.ZonedDateTime
      ? input.now
      : Temporal.Instant.from(computedAt).toZonedDateTimeISO('UTC');
  if (input.system === 'iching') {
    if (Object.keys(input.options?.school ?? {}).length)
      throw new EngineError('E_UNSUPPORTED_SCHOOL');
    // DESIGN-GAP: Uniform question carries the documented divination input; defaults are time Meihua and other/general categories.
    const question = input.question ?? {};
    const method = question.method ?? 'meihua';
    const cast = parseInput(IchingInputSchema, {
      category: 'other',
      ...question,
      method,
      seed: input.seed ?? question.seed ?? computedAt,
      ...(method === 'meihua' && !question.meihua ? { meihua: { castBy: 'time', at: now } } : {}),
    });
    chart = computeIching(cast, now);
    schoolUsed =
      cast.method === 'meihua'
        ? { method: 'meihua', trigramOrder: 'xiantian' }
        : { method: 'liuyao', naJia: 'jingfang', ziHour: 'zi_unified' };
  }
  if (input.system === 'qimen') {
    const cast = parseInput(QimenInputSchema, {
      at: now,
      category: 'general',
      ...input.question,
      options: {
        school: {
          layout: 'rotating',
          juMethod: 'chaibu',
          centerLodge: 'kun2',
          useApparentSolarTime: false,
          ...input.options?.school,
        },
      },
    });
    chart = computeQimen(cast);
    schoolUsed = { ...cast.options.school, ziHour: 'zi_unified' };
  }
  if (birth && (input.system === 'astrology' || input.system === 'vedic')) {
    // DESIGN-GAP: School option names follow the chart fields; expose node/rulership as explicit professional-view choices.
    const school = input.options?.school ?? {};
    const allowed =
      input.system === 'astrology'
        ? ['houseSystem', 'node', 'rulership', 'zodiac']
        : ['ayanamsa', 'houseSystem', 'node', 'dasha'];
    if (
      Object.keys(school).some((key) => !allowed.includes(key)) ||
      (school.node !== undefined && !['mean', 'true'].includes(String(school.node))) ||
      (input.system === 'astrology' &&
        ((school.houseSystem !== undefined &&
          !['placidus', 'whole_sign', 'equal'].includes(String(school.houseSystem))) ||
          (school.rulership !== undefined &&
            !['modern', 'traditional'].includes(String(school.rulership))) ||
          (school.zodiac !== undefined && school.zodiac !== 'tropical'))) ||
      (input.system === 'vedic' &&
        ((school.ayanamsa !== undefined && school.ayanamsa !== 'lahiri') ||
          (school.houseSystem !== undefined && school.houseSystem !== 'whole_sign') ||
          (school.dasha !== undefined && school.dasha !== 'vimshottari')))
    )
      throw new EngineError('E_UNSUPPORTED_SCHOOL');
    const node =
      school.node === 'mean'
        ? 'mean'
        : school.node === 'true'
          ? 'true'
          : input.system === 'vedic'
            ? 'mean'
            : 'true';
    if (input.system === 'astrology') {
      const chart = computeAstrology(birth, {
        houseSystem:
          school.houseSystem === 'equal'
            ? 'equal'
            : school.houseSystem === 'whole_sign'
              ? 'whole_sign'
              : 'placidus',
        node,
        rulership: school.rulership === 'traditional' ? 'traditional' : 'modern',
      });
      if (
        (school.houseSystem === undefined || school.houseSystem === 'placidus') &&
        chart.houseSystem === 'whole_sign'
      )
        warnings.push({
          code: 'W_HOUSE_SYSTEM_FALLBACK',
          messageKey: 'engine.warnings.W_HOUSE_SYSTEM_FALLBACK',
        });
      return {
        system: input.system,
        engineVersion: ENGINE_VERSION,
        computedAt,
        input: birth,
        chart,
        meta: {
          schoolUsed: {
            houseSystem: chart.houseSystem,
            zodiac: 'tropical',
            node,
            rulership: school.rulership ?? 'modern',
          },
          warnings,
          debug: { jdUT: chart.jdUT, obliquity: chart.obliquity, chironApproximate: true },
        },
      };
    }
    const chart = computeVedic(birth, computedAt, { node });
    return {
      system: input.system,
      engineVersion: ENGINE_VERSION,
      computedAt,
      input: birth,
      chart,
      meta: {
        schoolUsed: { ayanamsa: 'lahiri', houseSystem: 'whole_sign', node, dasha: 'vimshottari' },
        warnings,
        debug: { jdUT: chart.jdUT, ayanamsa: chart.ayanamsa, yogaConditions: YOGA_CONDITIONS },
      },
    };
  }
  if (input.system === 'daily' && birth) {
    if (!input.seed) throw new EngineError('E_INVALID_INPUT');
    const date = dailyDateAt(
      computedAt,
      input.now instanceof Temporal.ZonedDateTime ? input.now.timeZoneId : birth.local.tz,
    );
    const baziChart = computeBazi(birth, { now: input.now, yearsAround: 0 });
    chart = computeDaily({
      birth,
      baziChart,
      astroChart: computeAstrology(birth),
      vedicChart: null,
      date,
      seed: input.seed,
    });
    schoolUsed = { bazi: 'weighted_v1', zodiac: 'tropical', ayanamsa: 'lahiri', deck: 'rws' };
    warnings.push(...baziWarnings(birth, baziChart));
  }
  return EngineResultSchema.parse({
    system: input.system,
    engineVersion: ENGINE_VERSION,
    computedAt,
    input: birth,
    chart: chartSchemas[input.system].parse(chart),
    meta: {
      schoolUsed,
      warnings,
    },
  });
}
