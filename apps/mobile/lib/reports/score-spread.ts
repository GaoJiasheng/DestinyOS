import { SCORE_DIMENSIONS } from '@tianji/ui-core';
import type { Report } from '@tianji/interpret';

/**
 * Five identical scores (or missing ones) carry no information, so no score block is shown.
 * Natal systems without a scoring basis all come out as 3 of 5, which must not be displayed.
 */
export function hasScoreSpread(
  scores: Partial<Report['headline']['scores']> | null | undefined,
): boolean {
  if (!scores) return false;
  const values = SCORE_DIMENSIONS.map((dimension) => scores[dimension]);
  if (values.some((value) => typeof value !== 'number')) return false;
  return new Set(values).size > 1;
}
