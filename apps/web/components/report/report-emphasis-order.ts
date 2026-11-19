import type { EmphasisBasis } from '@tianji/interpret/emphasis';
/** Displayed dimensions in reading order; health is never assessed for a natal chart. */
export const EMPHASIS_DIMS = ['career', 'wealth', 'love', 'social'] as const;
export type ShownDim = (typeof EMPHASIS_DIMS)[number];
/** Positive hits first, then neutral, then negative; stored order is kept within each group. */
export function orderBasis(basis: EmphasisBasis[]): EmphasisBasis[] {
  const rank = (b: EmphasisBasis) => (b.delta > 0 ? 0 : b.delta === 0 ? 1 : 2);
  return basis
    .map((item, index) => ({ item, index }))
    .sort((a, b) => rank(a.item) - rank(b.item) || a.index - b.index)
    .map(({ item }) => item);
}
