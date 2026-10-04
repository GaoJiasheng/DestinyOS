export function zhChars(text: string): number {
  return [...text.replace(/\s/g, '')].length;
}
export function enWords(text: string): number {
  return text.match(/[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu)?.length ?? 0;
}
// DESIGN-GAP: Similarity uses Dice overlap of normalized character 3-gram sets in both languages.
/** Normalised character triples used by the editorial duplicate scan. */
export function trigrams(text: string): Set<string> {
  const chars = [...text.toLowerCase().replace(/[\p{P}\p{Z}\s]/gu, '')];
  return new Set(
    chars.length < 3
      ? [chars.join('')]
      : chars.slice(0, -2).map((_, i) => chars.slice(i, i + 3).join('')),
  );
}
/** Dice overlap of precomputed triples; callers can reuse sets across corpus comparisons. */
export function trigramSimilarity(x: ReadonlySet<string>, y: ReadonlySet<string>): number {
  return (2 * [...x].filter((g) => y.has(g)).length) / (x.size + y.size || 1);
}
export function similarity(a: string, b: string): number {
  return trigramSimilarity(trigrams(a), trigrams(b));
}
export function deduplicate(items: string[], limit: number): string[] {
  const selected: string[] = [];
  for (const item of items) {
    if (!selected.some((other) => similarity(item, other) > 0.8)) selected.push(item);
    if (selected.length >= limit) break;
  }
  return selected;
}
