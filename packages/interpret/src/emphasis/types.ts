import type { Dim } from '@tianji/content';
/** Relative emphasis bands; band 1 is never produced so the weakest area still reads as workable. */
export type EmphasisLevel = 2 | 3 | 4 | 5;
/** One rule hit. Params hold stable chart keys (star, palace, brightness, mutagen), never localized text. */
export type EmphasisBasis = { ruleId: string; delta: number; params: Record<string, string> };
export type EmphasisDimension = {
  level: EmphasisLevel;
  /** Clamped rule total, always a multiple of 0.125. */
  raw: number;
  basis: EmphasisBasis[];
};
/** Locale-free chart emphasis stored with a report; language switches re-render it, never recompute. */
export type Emphasis = {
  /** scoringVersion of the rule table that produced this result. */
  version: string;
  dims: Partial<Record<Dim, EmphasisDimension>>;
  /** At most two dimensions at level 4 or 5, raw descending, ties in dims order. */
  top: Dim[];
  omitted: Dim[];
};
/** Whether a system offers chart emphasis; stated explicitly instead of inferring it from flat scores. */
export type EmphasisSupport =
  | { status: 'available'; compute: (chart: unknown) => Emphasis }
  | { status: 'deferred' }
  | { status: 'not_applicable' };
