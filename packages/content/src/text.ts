export function zhChars(text: string): number {
  return [...text.replace(/\s/g, '')].length;
}
export function enWords(text: string): number {
  return text.match(/[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu)?.length ?? 0;
}
// DESIGN-GAP: Similarity uses Dice overlap of normalized character 3-gram sets in both languages.
function grams(text: string): Set<string> {
  const chars = [...text.toLowerCase().replace(/[\p{P}\p{Z}\s]/gu, '')];
  return new Set(
    chars.length < 3
      ? [chars.join('')]
      : chars.slice(0, -2).map((_, i) => chars.slice(i, i + 3).join('')),
  );
}
function overlap(x: Set<string>, y: Set<string>): number {
  let count = 0;
  for (const gram of x) if (y.has(gram)) count++;
  return (2 * count) / (x.size + y.size || 1);
}
export function similarity(a: string, b: string): number {
  return overlap(grams(a), grams(b));
}
/** Cache normalized 3-grams within one corpus comparison; the caller owns the cache lifetime. */
export function createSimilarityComparator(): (a: string, b: string) => number {
  const cache = new Map<string, Set<string>>();
  const get = (text: string) => {
    let value = cache.get(text);
    if (!value) {
      value = grams(text);
      cache.set(text, value);
    }
    return value;
  };
  return (a, b) => overlap(get(a), get(b));
}
export function deduplicate(items: string[], limit: number): string[] {
  const selected: string[] = [];
  for (const item of items) {
    if (!selected.some((other) => similarity(item, other) > 0.8)) selected.push(item);
    if (selected.length >= limit) break;
  }
  return selected;
}
