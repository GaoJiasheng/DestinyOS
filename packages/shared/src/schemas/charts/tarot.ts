import { z } from 'zod';
import { Element4 } from '../../enums';
import { TAROT_CARDS } from '../../constants/tarot-cards';
import { TAROT_SPREADS } from '../../constants/tarot-spreads';
export const SpreadKeySchema = z.enum([
  'single',
  'yes_no',
  'three_ppf',
  'three_sao',
  'relationship',
  'decision',
  'celtic_cross',
  'year_ahead',
]);
export const CategorySchema = z.enum(['love', 'career', 'wealth', 'decision', 'self', 'general']);
export type Category = z.infer<typeof CategorySchema>;
export const CardKeySchema = z.custom<(typeof TAROT_CARDS)[number]['key']>((value) =>
  TAROT_CARDS.some((card) => card.key === value),
);
const count = z.number().int().nonnegative();
const pct = z.number().min(0).max(100);
export const TarotChartSchema = z
  .object({
    spread: SpreadKeySchema,
    category: CategorySchema,
    // DESIGN-GAP: Retain the documented question field but permit only SHA-256, never plaintext.
    question: z
      .string()
      .regex(/^[a-f0-9]{64}$/)
      .optional(),
    allowReversed: z.boolean(),
    cards: z
      .array(
        z
          .object({
            position: z.string(),
            cardKey: CardKeySchema,
            reversed: z.boolean(),
            order: count,
          })
          .strict(),
      )
      .min(1)
      .max(13),
    stats: z
      .object({
        majorPct: pct,
        elements: z.object({ fire: count, earth: count, air: count, water: count }).strict(),
        courtCount: count,
        reversedPct: pct,
        repeatedNumbers: z.array(count),
        dominantElement: z.nativeEnum(Element4).optional(),
        missingElements: z.array(z.nativeEnum(Element4)),
      })
      .strict(),
    combos: z.array(z.string()),
    yesNo: z
      .object({ answer: z.enum(['yes', 'no', 'maybe']), confidence: z.number().min(0).max(1) })
      .strict()
      .optional(),
    seed: z.string().min(1),
  })
  .strict()
  .superRefine((chart, ctx) => {
    const positions = TAROT_SPREADS[chart.spread];
    if (
      chart.cards.length !== positions.length ||
      new Set(chart.cards.map((c) => c.cardKey)).size !== chart.cards.length ||
      chart.cards.some(
        (c, i) =>
          c.position !== positions[i]?.key ||
          c.order !== i ||
          (!chart.allowReversed && c.reversed) ||
          (positions[i]?.readUpright && c.reversed),
      )
    )
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'engine.errors.E_ENGINE_INTERNAL',
        path: ['cards'],
      });
    if ((chart.spread === 'yes_no') !== Boolean(chart.yesNo))
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'engine.errors.E_ENGINE_INTERNAL',
        path: ['yesNo'],
      });
  });
export type TarotChart = z.infer<typeof TarotChartSchema>;
