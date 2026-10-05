import { z } from 'zod';
import { ExportRequestSchema } from '@/lib/report-export-schema';
import {
  exportReading,
  exportKey,
  cachedExport,
  cacheExport,
  renderExport,
  exportFilename,
  exportMime,
} from '@/lib/report-export';
import { ApiError, errorResponse } from '@/lib/api-error';
import { assertRateLimit, ratelimit } from '@/lib/ratelimit';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;
const metadataSchema = z
  .object({ count: z.number().int().min(1).max(80), pages: z.boolean() })
  .strict();
const partKey = (key: string, index: number) => (index === 0 ? key : `${key}-${index}`);
const pageFilename = (filename: string, index: number) =>
  filename.replace(/\.zip$/, `-${String(index + 1).padStart(2, '0')}.png`);
/** Generate with streamed progress; authorization and quota precede any cached file lookup. */
export async function POST(request: Request) {
  try {
    const input = ExportRequestSchema.parse(await request.json());
    const { userId, reading } = await exportReading(input);
    assertRateLimit(await ratelimit('export', userId));
    // DESIGN-GAP: Streaming keeps the serverless invocation alive while reporting actual renderer stages; no in-memory background job is assumed.
    let disconnected = false;
    const stream = new ReadableStream<Uint8Array>({
      cancel() {
        disconnected = true;
      },
      async start(controller) {
        const emit = (value: unknown) => {
          if (!disconnected)
            controller.enqueue(new TextEncoder().encode(JSON.stringify(value) + '\n'));
        };
        try {
          const key = exportKey(input, reading, userId);
          let data = await cachedExport(key);
          let metadata = { count: 1, pages: false };
          emit({ progress: data ? 95 : 5 });
          if (data) {
            const stored = await cachedExport(`${key}-meta`);
            if (stored)
              metadata = metadataSchema.parse(JSON.parse(new TextDecoder().decode(stored)));
          } else {
            const result = await renderExport(input, reading, userId, (percent) =>
              emit({ progress: percent }),
            );
            const parts = Array.isArray(result) ? result : [result];
            metadata = { count: parts.length, pages: Array.isArray(result) };
            // Publish the first file last; a cache hit always has all accompanying pages and metadata.
            for (let i = 1; i < parts.length; i++)
              await cacheExport(
                partKey(key, i),
                parts[i]!,
                metadata.pages ? 'cover' : input.format,
              );
            await cacheExport(
              `${key}-meta`,
              new TextEncoder().encode(JSON.stringify(metadata)),
              input.format,
              'application/json',
            );
            data = parts[0]!;
            await cacheExport(key, data, metadata.pages ? 'cover' : input.format);
          }
          const query = new URLSearchParams(input);
          const filename = exportFilename(input, reading);
          emit({
            progress: 100,
            url: `/api/export?${query}`,
            filename: metadata.pages ? pageFilename(filename, 0) : filename,
            ...(metadata.pages
              ? {
                  files: Array.from({ length: metadata.count }, (_, index) => ({
                    url: `/api/export?${query}&page=${index}`,
                    filename: pageFilename(filename, index),
                  })),
                }
              : {}),
          });
        } catch {
          emit({ error: 'E_INTERNAL' });
        } finally {
          if (!disconnected) controller.close();
        }
      },
    });
    return new Response(stream, {
      headers: {
        'Content-Type': 'application/x-ndjson',
        'Cache-Control': 'private, no-store',
        'X-Accel-Buffering': 'no',
      },
    });
  } catch (error) {
    return errorResponse(
      error instanceof ApiError
        ? error
        : error instanceof z.ZodError || error instanceof SyntaxError
          ? new ApiError('E_VALIDATION', 'Invalid export request', 400)
          : new ApiError('E_INTERNAL', 'Export unavailable', 500),
    );
  }
}
/** Download rechecks ownership and current entitlement; no permanent public artifact URLs are exposed. */
export async function GET(request: Request) {
  try {
    const query = new URL(request.url).searchParams;
    const index = z.coerce
      .number()
      .int()
      .min(0)
      .max(79)
      .parse(query.get('page') ?? 0);
    query.delete('page');
    const input = ExportRequestSchema.parse(Object.fromEntries(query));
    const { userId, reading } = await exportReading(input);
    const key = exportKey(input, reading, userId);
    const stored = await cachedExport(`${key}-meta`);
    const metadata = stored
      ? metadataSchema.parse(JSON.parse(new TextDecoder().decode(stored)))
      : { count: 1, pages: false };
    if (index >= metadata.count) throw new ApiError('E_NOT_FOUND', 'Export page unavailable', 404);
    const data = await cachedExport(partKey(key, index));
    if (!data) throw new ApiError('E_NOT_FOUND', 'Export expired', 404);
    // DESIGN-GAP: Stream downloads to support artifacts above Vercel's buffered response size limit.
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        for (let offset = 0; offset < data.length; offset += 65536)
          controller.enqueue(data.subarray(offset, offset + 65536));
        controller.close();
      },
    });
    const filename = exportFilename(input, reading);
    return new Response(body, {
      headers: {
        'Content-Type': metadata.pages ? 'image/png' : exportMime(input.format),
        'Content-Disposition': `attachment; filename="${metadata.pages ? pageFilename(filename, index) : filename}"`,
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    return errorResponse(
      error instanceof ApiError
        ? error
        : error instanceof z.ZodError
          ? new ApiError('E_VALIDATION', 'Invalid export request', 400)
          : new ApiError('E_INTERNAL', 'Export unavailable', 500),
    );
  }
}
