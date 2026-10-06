import { gzipSync, gunzipSync, strToU8, strFromU8 } from 'fflate';
import { z } from 'zod';
import type { PrismaClient } from '@prisma/client';
import { getDb } from './db';
const envelope = z.object({ encoding: z.literal('gzip-base64'), data: z.string() });
const manifestSchema = z.object({
  encoding: z.literal('chunked-gzip'),
  systems: z.array(z.string()),
});
/** Compress trusted immutable knowledge JSON losslessly. */
export function packSnapshot(value: unknown) {
  return {
    encoding: 'gzip-base64' as const,
    data: Buffer.from(gzipSync(strToU8(JSON.stringify(value)), { level: 6 })).toString('base64'),
  };
}
/** Restore a gzip snapshot; legacy uncompressed local snapshots remain readable. */
export function unpackSnapshot(value: unknown): unknown {
  const parsed = envelope.safeParse(value);
  return parsed.success
    ? (JSON.parse(strFromU8(gunzipSync(Buffer.from(parsed.data.data, 'base64')))) as unknown)
    : value;
}
// DESIGN-GAP: An all-system snapshot exceeds D1's 2MiB row limit even after gzip; each immutable system is split into 512KiB chunks and published in the same atomic batch.
/** Prepare a bounded manifest and ordered chunks for an immutable release. */
export function snapshotParts(value: unknown) {
  const bundles = z.record(z.unknown()).parse(value);
  const chunks: { system: string; ordinal: number; data: string }[] = [];
  for (const [system, bundle] of Object.entries(bundles)) {
    const packed = packSnapshot(bundle).data;
    for (let offset = 0; offset < packed.length; offset += 512 * 1024)
      chunks.push({
        system,
        ordinal: offset / (512 * 1024),
        data: packed.slice(offset, offset + 512 * 1024),
      });
  }
  return { manifest: { encoding: 'chunked-gzip' as const, systems: Object.keys(bundles) }, chunks };
}
/** Load and restore the immutable release chunks from D1; clients never receive storage envelopes. */
export async function loadSnapshot(
  version: string,
  value: unknown,
  client?: Pick<PrismaClient, 'knowledgeBundleChunk'>,
  requestedSystem?: string,
): Promise<unknown> {
  const manifest = manifestSchema.safeParse(value);
  if (!manifest.success) return unpackSnapshot(value);
  const query = {
    // DESIGN-GAP: Report requests read only one system; admin export still restores the entire release.
    where: { releaseVersion: version, ...(requestedSystem ? { system: requestedSystem } : {}) },
    orderBy: [{ system: 'asc' as const }, { ordinal: 'asc' as const }],
  };
  const rows = client
    ? await client.knowledgeBundleChunk.findMany(query)
    : await getDb().knowledgeBundleChunk.findMany(query);
  return Object.fromEntries(
    manifest.data.systems
      .filter((system) => !requestedSystem || system === requestedSystem)
      .map((system) => {
        const parts = rows.filter((r) => r.system === system);
        if (!parts.length || parts.some((p, i) => p.ordinal !== i))
          throw new Error('Incomplete knowledge snapshot');
        return [
          system,
          unpackSnapshot({ encoding: 'gzip-base64', data: parts.map((r) => r.data).join('') }),
        ];
      }),
  );
}
