import { z } from 'zod';
import { ExportRequestSchema, type ExportRequest } from '../report-export-schema';
import {
  exportReading,
  exportKey,
  cachedExport,
  cacheExport,
  renderExport,
  exportFilename,
  exportMime,
} from '../report-export';
import { assertRateLimit, ratelimit } from '../ratelimit';
import { ApiError } from '../api-error';
const metadataSchema = z
  .object({ count: z.number().int().min(1).max(80), pages: z.boolean() })
  .strict();
const partKey = (key: string, index: number) => (index === 0 ? key : `${key}-${index}`);
/** Reuse Web rendering, cache, limits and entitlement checks; download URLs require the same Bearer owner. */
export async function mobileExport(userId: string, readingId: string, raw: unknown) {
  const input = ExportRequestSchema.omit({ readingId: true }).parse(raw);
  const request: ExportRequest = { ...input, readingId };
  const { reading } = await exportReading(request, userId);
  assertRateLimit(await ratelimit('export', userId));
  const key = exportKey(request, reading, userId);
  let data = await cachedExport(key),
    metadata = { count: 1, pages: false };
  if (data) {
    const stored = await cachedExport(`${key}-meta`);
    if (stored) metadata = metadataSchema.parse(JSON.parse(new TextDecoder().decode(stored)));
  } else {
    const result = await renderExport(request, reading, userId, () => undefined);
    const parts = Array.isArray(result) ? result : [result];
    metadata = { count: parts.length, pages: Array.isArray(result) };
    for (let i = 1; i < parts.length; i++)
      await cacheExport(partKey(key, i), parts[i]!, metadata.pages ? 'cover' : request.format);
    await cacheExport(
      `${key}-meta`,
      new TextEncoder().encode(JSON.stringify(metadata)),
      request.format,
      'application/json',
    );
    data = parts[0]!;
    await cacheExport(key, data, metadata.pages ? 'cover' : request.format);
  }
  const filename = exportFilename(request, reading);
  const files = Array.from({ length: metadata.count }, (_, index) => ({
    url: `/api/v1/mobile/export/${readingId}?${new URLSearchParams({ ...input, page: String(index) })}`,
    filename: metadata.pages
      ? filename.replace(/\.zip$/, `-${String(index + 1).padStart(2, '0')}.png`)
      : filename,
  }));
  return { ...files[0], files, expiresIn: 86400 };
}
/** Recheck current account, ownership and plan on every private download, including cached files. */
export async function mobileDownload(userId: string, readingId: string, query: URLSearchParams) {
  const page = z.coerce
    .number()
    .int()
    .min(0)
    .max(79)
    .parse(query.get('page') ?? 0);
  query.delete('page');
  const request = ExportRequestSchema.parse({ ...Object.fromEntries(query), readingId });
  const { reading } = await exportReading(request, userId),
    key = exportKey(request, reading, userId);
  const stored = await cachedExport(`${key}-meta`);
  const metadata = stored
    ? metadataSchema.parse(JSON.parse(new TextDecoder().decode(stored)))
    : { count: 1, pages: false };
  if (page >= metadata.count) throw new ApiError('E_NOT_FOUND', 'Export page unavailable', 404);
  const data = await cachedExport(partKey(key, page));
  if (!data) throw new ApiError('E_NOT_FOUND', 'Export expired', 404);
  const filename = exportFilename(request, reading);
  return new Response(new Uint8Array(data), {
    headers: {
      'Content-Type': metadata.pages ? 'image/png' : exportMime(request.format),
      'Content-Disposition': `attachment; filename="${metadata.pages ? filename.replace(/\.zip$/, `-${String(page + 1).padStart(2, '0')}.png`) : filename}"`,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
