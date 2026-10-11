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
/** Reuse Web rendering, cache, limits and entitlement checks; download URLs require the same Bearer owner. */
export async function mobileExport(userId: string, readingId: string, raw: unknown) {
  const input = ExportRequestSchema.omit({ readingId: true }).parse(raw);
  const request: ExportRequest = { ...input, readingId };
  const { reading } = await exportReading(request, userId);
  assertRateLimit(await ratelimit('export', userId));
  const key = exportKey(request, reading, userId);
  if (!(await cachedExport(key))) {
    const data = await renderExport(request, reading, userId, () => undefined);
    await cacheExport(key, data, request.format);
  }
  // DESIGN-GAP: Preserve the native files array and page=0 URL while adopting the shared single JPEG/PDF renderer.
  const file = {
    url: `/api/v1/mobile/export/${readingId}?${new URLSearchParams({ ...input, page: '0' })}`,
    filename: exportFilename(request, reading),
  };
  return { ...file, files: [file], expiresIn: 86400 };
}
/** Recheck current account, ownership and plan on every private download, including cached files. */
export async function mobileDownload(userId: string, readingId: string, query: URLSearchParams) {
  z.coerce
    .number()
    .int()
    .min(0)
    .max(0)
    .parse(query.get('page') ?? 0);
  query.delete('page');
  const request = ExportRequestSchema.parse({ ...Object.fromEntries(query), readingId });
  const { reading } = await exportReading(request, userId),
    key = exportKey(request, reading, userId);
  const data = await cachedExport(key);
  if (!data) throw new ApiError('E_NOT_FOUND', 'Export expired', 404);
  const filename = exportFilename(request, reading);
  return new Response(new Uint8Array(data), {
    headers: {
      'Content-Type': exportMime(request.format),
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
