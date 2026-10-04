import { z } from 'zod';
import { Temporal } from '@js-temporal/polyfill';
import {
  TAROT_CARDS,
  TAROT_SPREADS,
  TarotChartSchema,
  SpreadKeySchema,
  CategorySchema,
  Element4,
  type TarotChart,
} from '@tianji/shared';
import { createRandom, hashSeed } from '../common/random';
import { EngineError } from '../common/error';
import { detectTarotCombinations } from './combos';
export { TarotChartSchema } from '@tianji/shared';
export type { TarotChart } from '@tianji/shared';
export * from './combos';
const inputSchema = z
  .object({
    seed: z.string().min(1),
    spread: SpreadKeySchema.default('single'),
    category: CategorySchema.default('general'),
    question: z.string().max(120).optional(),
    allowReversed: z.boolean().default(true),
    pickedIndices: z.array(z.number().int().min(0).max(77)).optional(),
  })
  .strict()
  .superRefine((input, ctx) => {
    if (
      input.pickedIndices &&
      (input.pickedIndices.length !== TAROT_SPREADS[input.spread].length ||
        new Set(input.pickedIndices).size !== input.pickedIndices.length)
    )
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'engine.errors.E_INVALID_INPUT',
        path: ['pickedIndices'],
      });
  });
export type TarotInput = z.input<typeof inputSchema>;
/** Summarize actual read orientations. Percentages use 0–100, element counts are integers. */
export function tarotStatistics(cards: TarotChart['cards']): TarotChart['stats'] {
  if (!cards.length) throw new EngineError('E_INVALID_INPUT');
  const metadata = cards.map((card) => {
    const found = TAROT_CARDS.find((data) => data.key === card.cardKey);
    if (!found) throw new EngineError('E_INVALID_INPUT');
    return found;
  });
  const elements = { fire: 0, earth: 0, air: 0, water: 0 };
  const numbers = new Map<number, number>();
  for (const card of metadata) {
    elements[card.element]++;
    // DESIGN-GAP: Court ranks are roles, excluded from numeric repetition; the Fool retains zero.
    if (card.arcana === 'major' || card.number <= 10)
      numbers.set(card.number, (numbers.get(card.number) ?? 0) + 1);
  }
  // DESIGN-GAP: A 50/50 element tie uses shared Element4 order for the single dominantElement field.
  const dominantElement = Object.values(Element4).find(
    (element) => elements[element] >= cards.length / 2,
  );
  return {
    majorPct: (metadata.filter((c) => c.arcana === 'major').length / cards.length) * 100,
    elements,
    courtCount: metadata.filter((c) => c.arcana === 'minor' && c.number > 10).length,
    reversedPct: (cards.filter((c) => c.reversed).length / cards.length) * 100,
    repeatedNumbers: [...numbers]
      .filter(([, n]) => n > 1)
      .map(([number]) => number)
      .sort((a, b) => a - b),
    ...(dominantElement ? { dominantElement } : {}),
    missingElements: Object.values(Element4).filter((element) => elements[element] === 0),
  };
}
/** Deterministic Fisher–Yates RWS draw. Pick indices are hashed into the seed before shuffling. */
export function computeTarot(raw: TarotInput): TarotChart {
  const parsed = inputSchema.safeParse(raw);
  if (!parsed.success) throw new EngineError('E_INVALID_INPUT');
  const input = parsed.data;
  const seed = input.pickedIndices
    ? hashSeed(input.seed + input.pickedIndices.join(','))
    : input.seed;
  const rng = createRandom(seed);
  const deck = [...TAROT_CARDS];
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(rng.next() * (i + 1));
    [deck[i], deck[j]] = [deck[j]!, deck[i]!];
  }
  const cards = TAROT_SPREADS[input.spread].map((position, order) => {
    const reversed = input.allowReversed && rng.next() < 0.5;
    return {
      position: position.key,
      cardKey: deck[order]!.key,
      reversed: position.readUpright ? false : reversed,
      order,
    };
  });
  const stats = tarotStatistics(cards);
  const combos = detectTarotCombinations(cards);
  // DESIGN-GAP: Statistical and position relationships are stable combo keys for downstream KU triggers.
  if (stats.majorPct >= 50) combos.push('major_theme');
  if (stats.dominantElement) combos.push(`dominant_${stats.dominantElement}`);
  combos.push(...stats.missingElements.map((el) => `missing_${el}`));
  if (stats.courtCount >= 2) combos.push('court_roles');
  if (stats.reversedPct >= 60) combos.push('reversed_theme');
  combos.push(...stats.repeatedNumbers.map((n) => `repeated_${n}`));
  if (
    input.spread === 'three_ppf' ||
    input.spread === 'three_sao' ||
    input.spread === 'celtic_cross'
  ) {
    const first = cards[0]!,
      last = cards.at(-1)!;
    if (deck[0]!.element !== deck[cards.length - 1]!.element)
      combos.push(
        input.spread === 'celtic_cross' ? 'present_outcome_element_shift' : 'trend_element_shift',
      );
    if (first.reversed !== last.reversed)
      combos.push(
        input.spread === 'celtic_cross'
          ? 'present_outcome_orientation_shift'
          : 'trend_orientation_shift',
      );
  }
  const card = deck[0]!;
  // DESIGN-GAP: Yes/no is a reflective heuristic; reversal softens a definite answer to maybe, confidence .5/.75.
  const answer = cards[0]!.reversed ? 'maybe' : card.yesNo;
  return TarotChartSchema.parse({
    spread: input.spread,
    category: input.category,
    allowReversed: input.allowReversed,
    cards,
    stats,
    combos,
    seed,
    ...(input.question !== undefined ? { question: hashSeed(input.question) } : {}),
    ...(input.spread === 'yes_no'
      ? { yesNo: { answer, confidence: answer === 'maybe' ? 0.5 : 0.75 } }
      : {}),
  });
}
/** SHA-256 daily protocol for a user/anonymous ID and YYYY-MM-DD in the user's local time zone. */
export function dailyTarotSeed(userId: string, localDate: string): string {
  if (!userId || !/^\d{4}-\d{2}-\d{2}$/.test(localDate)) throw new EngineError('E_INVALID_INPUT');
  try {
    Temporal.PlainDate.from(localDate);
  } catch {
    throw new EngineError('E_INVALID_INPUT');
  }
  return hashSeed(`${userId}|${localDate}|daily-tarot`);
}
/** Draw one daily card from an already-derived daily seed, without reading a clock. */
export function drawDaily(seed: string): TarotChart['cards'][number] {
  return computeTarot({ seed, spread: 'single' }).cards[0]!;
}
