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
  type EngineResult,
  type EngineWarning,
} from '@tianji/shared';
import { EngineError } from './common/error';
import { version } from '../package.json';
import { computeIching, IchingInputSchema } from './iching';
import { computeQimen, QimenInputSchema } from './qimen';
import { parseInput } from './common/divination';
export * from './iching';
export * from './qimen';
export * from './common';
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
    !['iching', 'qimen'].includes(input.system) &&
    Object.keys(input.options?.school ?? {}).length
  )
    throw new EngineError('E_UNSUPPORTED_SCHOOL');
  const birth = input.birth ?? null;
  if (['bazi', 'ziwei', 'astrology', 'vedic', 'daily'].includes(input.system) && !birth)
    throw new EngineError('E_INVALID_INPUT');
  if (input.system === 'ziwei' && birth?.timeUnknown)
    throw new EngineError('E_REQUIRES_BIRTH_TIME');
  const warnings: EngineWarning[] = [...(birth?.warnings ?? [])];
  if (birth?.timeUnknown && input.system === 'bazi')
    warnings.push({ code: 'W_NO_HOUR_PILLAR', messageKey: 'engine.warnings.W_NO_HOUR_PILLAR' });
  if (birth?.timeUnknown && ['astrology', 'vedic'].includes(input.system))
    warnings.push({ code: 'W_NOON_CHART', messageKey: 'engine.warnings.W_NOON_CHART' });
  let chart: Record<string, unknown> = {};
  let schoolUsed: Record<string, string | number | boolean> = {};
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
  return EngineResultSchema.parse({
    system: input.system,
    engineVersion: ENGINE_VERSION,
    computedAt,
    input: birth,
    chart: chartSchemas[input.system].parse(chart),
    meta: {
      schoolUsed,
      warnings,
      ...(!['iching', 'qimen'].includes(input.system) ? { debug: { placeholder: true } } : {}),
    },
  });
}
