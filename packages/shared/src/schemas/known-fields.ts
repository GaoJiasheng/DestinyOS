import type { z } from 'zod';

/**
 * Parse a saved chart with its strict schema while ignoring object keys a newer engine added.
 *
 * Chart schemas are strict so the engine cannot leak unexpected data, but a chart computed by a
 * newer server (and synced to an older App) may carry extra optional fields. Those must not stop
 * the older client from drawing or sharing it. Only unknown keys are forgiven: a missing field,
 * a wrong type or a bad value still fails exactly as before.
 */
export function parseKnownFields<T extends z.ZodTypeAny>(schema: T, value: unknown): z.output<T> {
  const first = schema.safeParse(value);
  if (first.success) return first.data;
  const extra = first.error.issues.filter((issue) => issue.code === 'unrecognized_keys');
  if (!extra.length || extra.length !== first.error.issues.length) throw first.error;
  // Charts are plain JSON, so a JSON copy is a faithful clone on every runtime (including Hermes).
  const copy = JSON.parse(JSON.stringify(value)) as unknown;
  for (const issue of extra) {
    const parent = issue.path.reduce<unknown>(
      (node, key) =>
        node && typeof node === 'object' ? (node as Record<string, unknown>)[key] : undefined,
      copy,
    );
    if (parent && typeof parent === 'object' && 'keys' in issue)
      for (const key of issue.keys) delete (parent as Record<string, unknown>)[key];
  }
  return schema.parse(copy);
}
