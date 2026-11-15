import { SpreadKeySchema } from '@tianji/shared/schemas/charts/tarot';
import type { SpreadKey } from '@tianji/shared/constants/tarot-spreads';

/** Maximum question length shared by the selection form and the draft schema. */
export const TAROT_QUESTION_MAX = 120;

export type TarotEntry = { spread: SpreadKey; question: string };

/**
 * Validate a direct ritual entry (`/tarot/reading?spread=…&q=…`).
 * @returns null when the spread is missing or not a documented key; the question is trimmed and clipped.
 */
export function parseTarotEntry(spread: unknown, question: unknown): TarotEntry | null {
  const parsed = SpreadKeySchema.safeParse(spread);
  if (!parsed.success) return null;
  return { spread: parsed.data, question: clipQuestion(question) };
}

/** Trim and clip untrusted query text; non-strings become an empty question. */
export function clipQuestion(question: unknown, max = TAROT_QUESTION_MAX): string {
  return typeof question === 'string' ? question.trim().slice(0, max) : '';
}

/**
 * Toggle a fan card: picking appends it to the next open position, picking it again removes it
 * and later picks move up one position. Full spreads ignore new picks until one is removed.
 */
export function togglePick(picked: number[], index: number, total: number): number[] {
  if (picked.includes(index)) return picked.filter((i) => i !== index);
  return picked.length >= total ? picked : [...picked, index];
}

/** Remove the card held by a spread position (0-based order). */
export function removePosition(picked: number[], order: number): number[] {
  return picked.filter((_, i) => i !== order);
}

/** Replay seeds are a developer tool: shown outside production builds or with `?debug` in the URL. */
export function showReplaySeed(search: string, production = process.env.NODE_ENV === 'production') {
  return !production || new URLSearchParams(search).has('debug');
}
