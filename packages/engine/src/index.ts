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
  SpreadKeySchema,
  CategorySchema,
  type EngineResult,
  type EngineWarning,
} from '@tianji/shared';
import { EngineError } from './common/error';
import { computeZiwei, ZIWEI_SCHOOL_DEFAULTS, type ZiweiSchool } from './ziwei';
import { computeTarot } from './tarot';
import { version } from '../package.json';
export * from './common';
export * from './bazi';
import { computeBazi, BaziSchoolSchema, baziWarnings } from './bazi';
export * from './ziwei';
export * from './tarot';
export const ENGINE_VERSION = version;
const chartSchemas = {
  bazi: BaziChartSchema,
  ziwei: ZiweiChartSchema,
  iching: IchingChartSchema,
  qimen: QimenChartSchema,
  tarot: TarotChartSchema,
  astrology: AstrologyChartSchema,
  vedic: VedicChartSchema,
  // DESIGN-GAP: daily is a persisted System in 06; retain an empty placeholder until its engine task.
  daily: z.object({}).strict(),
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
  // DESIGN-GAP: Unimplemented systems retain T-10 strict placeholders until their own engine tasks.
  if (!['bazi', 'ziwei'].includes(input.system) && Object.keys(input.options?.school ?? {}).length)
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
  let chart: Record<string, unknown>;
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
  } else chart = chartSchemas[input.system].parse({});
  return EngineResultSchema.parse({
    system: input.system,
    engineVersion: ENGINE_VERSION,
    computedAt,
    input: birth,
    chart,
    meta: {
      schoolUsed,
      warnings,
      ...(!['bazi', 'ziwei', 'tarot'].includes(input.system)
        ? { debug: { placeholder: true } }
        : {}),
    },
  });
}
