import { z } from 'zod';
import {
  IchingChartSchema,
  IchingCategorySchema,
  type IchingChart,
  type Element,
} from '@tianji/shared';
import { EngineError } from '../common/error';
import { createRandom } from '../common/random';
import { BRANCHES, hourBranch } from '../common/ganzhi';
import {
  ZonedTimeSchema,
  zonedTime,
  parseInput,
  calendarAt,
  verdictFor,
  clampScore,
} from '../common/divination';
import {
  TRIGRAMS,
  TRIGRAM_ELEMENTS,
  hexagramFromTrigrams,
  hexagramFromLines,
  mutualHexagram,
  changingHexagram,
  bodyUseRelation,
  seasonalStrength,
} from './topology';
import { installLiuyao } from './liuyao';
export * from './topology';
export * from './liuyao';
export { IchingChartSchema } from '@tianji/shared';
export const IchingInputSchema = z
  .object({
    method: z.enum(['meihua', 'liuyao']),
    question: z.string().max(120).optional(),
    category: IchingCategorySchema,
    meihua: z
      .object({
        castBy: z.enum(['time', 'numbers', 'random']),
        numbers: z.array(z.number().int().min(1).max(999)).min(2).max(3).optional(),
        at: ZonedTimeSchema,
      })
      .strict()
      .optional(),
    liuyao: z
      .object({
        throws: z
          .array(z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]))
          .length(6)
          .optional(),
      })
      .strict()
      .optional(),
    seed: z.string(),
  })
  .strict();
export type IchingInput = z.infer<typeof IchingInputSchema>;
/** Compute Meihua or Liuyao. Liuyao requires caller-provided zoned at as second argument (the documented input omits it). */
export function computeIching(raw: IchingInput, at?: z.infer<typeof ZonedTimeSchema>): IchingChart {
  const input = parseInput(IchingInputSchema, raw);
  // DESIGN-GAP: liuyao input omits its cast clock; accept it separately, supplied by uniform compute's explicit now.
  const clock = input.method === 'meihua' ? input.meihua?.at : at;
  if (
    !clock ||
    (input.method === 'meihua' && input.liuyao) ||
    (input.method === 'liuyao' && input.meihua)
  )
    throw new EngineError('E_INVALID_INPUT');
  const time = zonedTime(clock),
    calendar = calendarAt(time),
    hourNumber = BRANCHES.indexOf(hourBranch(time.hour)) + 1;
  const castAt = {
    local: time.toPlainDateTime().toString(),
    tz: time.timeZoneId,
    lunar: calendar.lunar,
    dayGanZhi: calendar.pillars.day,
    monthBranch: calendar.pillars.month.branch,
  };
  const random = createRandom(input.seed);
  if (input.method === 'liuyao') {
    // Three independent fair coins per throw, not four equiprobable line states.
    const throws =
      input.liuyao?.throws ??
      Array.from(
        { length: 6 },
        () =>
          [0, 1, 2].reduce<number>((sum) => sum + Math.floor(random.next() * 2), 0) as
            0 | 1 | 2 | 3,
      );
    const primary = hexagramFromLines(throws.map((t) => t % 2)),
      movingLines = throws.flatMap((t, i) => (t === 0 || t === 3 ? [i + 1] : [])),
      changing = changingHexagram(primary, movingLines);
    const installed = installLiuyao(
      primary,
      changing,
      movingLines,
      throws,
      calendar.pillars.day,
      calendar.pillars.month.branch,
      input.category,
    );
    return IchingChartSchema.parse({
      method: input.method,
      category: input.category,
      castAt,
      primary,
      changing,
      movingLines,
      liuyao: installed.chart,
      score: installed.score,
      verdict: verdictFor(installed.score),
    });
  }
  const config = input.meihua!;
  let source: number[], upper: number, lower: number, moving: number;
  const remainder = (n: number, period: number) => n % period || period;
  if (config.castBy === 'time') {
    const yearNumber = ((((calendar.lunar.year - 4) % 12) + 12) % 12) + 1;
    source = [yearNumber, calendar.lunar.month, calendar.lunar.day, hourNumber];
    const sum = source[0]! + source[1]! + source[2]!;
    upper = remainder(sum, 8);
    lower = remainder(sum + hourNumber, 8);
    moving = remainder(sum + hourNumber, 6);
  } else {
    if (config.castBy === 'numbers' && !config.numbers) throw new EngineError('E_INVALID_INPUT');
    source =
      config.castBy === 'random'
        ? [Math.floor(random.next() * 64) + 1, Math.floor(random.next() * 64) + 1]
        : config.numbers!;
    upper = remainder(source[0]!, 8);
    lower = remainder(source[1]!, 8);
    moving = remainder(source[2] ?? source[0]! + source[1]! + hourNumber, 6);
  }
  const primary = hexagramFromTrigrams(TRIGRAMS[upper - 1]!, TRIGRAMS[lower - 1]!),
    movingLines = [moving],
    changing = changingHexagram(primary, movingLines)!,
    mutual = mutualHexagram(primary);
  // DESIGN-GAP: §9 reverses Ding's body/use labels; normative §3.3 makes the moving trigram use.
  const body = moving <= 3 ? primary.upper : primary.lower,
    use = moving <= 3 ? primary.lower : primary.upper,
    element = TRIGRAM_ELEMENTS[body],
    relation = bodyUseRelation(element, TRIGRAM_ELEMENTS[use]);
  const mutualRelation = bodyUseRelation(
      element,
      TRIGRAM_ELEMENTS[moving <= 3 ? mutual.lower : mutual.upper],
    ),
    changingRelation = bodyUseRelation(
      element,
      TRIGRAM_ELEMENTS[moving <= 3 ? changing.lower : changing.upper],
    );
  const month = calendar.lunar.month;
  // DESIGN-GAP: Five seasons use lunar 1–3 spring, 4–5 summer, 6 late summer, 7–9 autumn, 10–12 winter.
  const season: Element =
    month <= 3
      ? 'wood'
      : month <= 5
        ? 'fire'
        : month === 6
          ? 'earth'
          : month <= 9
            ? 'metal'
            : 'water';
  const strength = seasonalStrength(element, season);
  const weights = {
    use_generates_body: 25,
    body_generates_use: -10,
    use_controls_body: -30,
    body_controls_use: 10,
    same: 20,
  };
  // DESIGN-GAP: Body/use 60%, process 15%, outcome 25%; seasonal vitality contributes up to eight points.
  const score = clampScore(
    Math.round(
      50 +
        weights[relation] * 0.6 +
        weights[mutualRelation] * 0.15 +
        weights[changingRelation] * 0.25 +
        { prosperous: 8, strong: 4, resting: 0, trapped: -4, dead: -8 }[strength],
    ),
  );
  return IchingChartSchema.parse({
    method: input.method,
    category: input.category,
    castAt,
    primary,
    changing,
    mutual,
    movingLines,
    meihua: {
      numbers: { upper, lower, moving, source },
      body,
      use,
      relation,
      seasonalStrength: strength,
      mutualRelation,
      changingRelation,
    },
    score,
    verdict: verdictFor(score),
  });
}
