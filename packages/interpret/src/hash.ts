/** Compute a stable unsigned 32-bit hash for deterministic transition and variant selection.
 * @param text Stable unit or variant identity. */
export function hash(text: string): number {
  let result = 2166136261;
  for (const char of text) result = Math.imul(result ^ char.charCodeAt(0), 16777619) >>> 0;
  return result;
}
