import { z } from 'zod';
import { anonymousDataSchema, type AnonymousData } from './anonymous-storage';
export type ImportError = 'E_IMPORT_JSON' | 'E_IMPORT_SHAPE' | 'E_IMPORT_EMPTY';
export type ParsedImport = { ok: true; data: AnonymousData } | { ok: false; error: ImportError };
// Settings export wraps the snapshot as { ok: true, data }; a bare snapshot is accepted too.
const exported = z.union([
  z.object({ ok: z.literal(true), data: anonymousDataSchema.nullable() }),
  anonymousDataSchema.transform((data) => ({ ok: true as const, data })),
]);
/** Validate a device export file with the same schema the encrypted store uses. */
export function parseAnonymousExport(text: string): ParsedImport {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return { ok: false, error: 'E_IMPORT_JSON' };
  }
  const parsed = exported.safeParse(json);
  if (!parsed.success) return { ok: false, error: 'E_IMPORT_SHAPE' };
  if (!parsed.data.data) return { ok: false, error: 'E_IMPORT_EMPTY' };
  return { ok: true, data: parsed.data.data };
}
/**
 * Merge an import into the device snapshot: readings dedupe by id (the device copy wins), newest 50 are kept,
 * and the device identity, profile, name and settings are only filled in where the device has none.
 */
export function mergeAnonymous(
  current: AnonymousData,
  incoming: AnonymousData,
): { data: AnonymousData; added: number } {
  const known = new Set(current.readings.map((reading) => reading.id));
  const fresh = incoming.readings.filter((reading) => !known.has(reading.id));
  const readings = [...current.readings, ...fresh]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 50);
  const kept = new Set(readings.map((reading) => reading.id));
  return {
    data: {
      ...current,
      profile: current.profile ?? incoming.profile,
      displayName: current.displayName ?? incoming.displayName,
      settings: { ...incoming.settings, ...current.settings },
      readings,
    },
    added: fresh.filter((reading) => kept.has(reading.id)).length,
  };
}
