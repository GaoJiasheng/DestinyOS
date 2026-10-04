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
export * from './common';
export * from './astrology';
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
  // Other system tasks retain their strict placeholders until implemented.
  if (
    !['astrology', 'vedic'].includes(input.system) &&
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
  return EngineResultSchema.parse({
    system: input.system,
    engineVersion: ENGINE_VERSION,
    computedAt,
    input: birth,
    chart: chartSchemas[input.system].parse({}),
    meta: { schoolUsed: {}, warnings, debug: { placeholder: true } },
  });
}
