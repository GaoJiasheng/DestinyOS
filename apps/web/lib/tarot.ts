import { z } from 'zod';
import { CategorySchema, SpreadKeySchema } from '@tianji/shared';
export const TarotDraftSchema = z.object({
  spread: SpreadKeySchema,
  category: CategorySchema,
  question: z.string().max(120),
  allowReversed: z.boolean(),
  seed: z.string().min(1).max(200),
});
export type TarotDraft = z.infer<typeof TarotDraftSchema>;
/** Visible deck indices after shuffle/cut; each index still influences the engine's seeded draw. */
export function ritualDeck(shuffles: number, cutOrder: number[]): number[] {
  // DESIGN-GAP: Ritual gestures permute indices, while the canonical engine hashes final pickedIndices. Three equal 26-card piles make cuts deterministic.
  const deck = Array.from({ length: 78 }, (_, i) => (i * 5 + shuffles * 7) % 78);
  const order = cutOrder.length === 3 ? cutOrder : [0, 1, 2];
  return order.flatMap((pile) => deck.slice(pile * 26, (pile + 1) * 26));
}
