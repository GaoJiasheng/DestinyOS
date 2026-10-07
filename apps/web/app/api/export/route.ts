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
export const maxDuration = 65;
/** Authorize every request; cached artifacts bypass only the browser generation quota. */
export async function POST(request: Request) {
  try {
    const input = ExportRequestSchema.parse(await request.json());
    const { userId, reading } = await exportReading(input);
    const key = exportKey(input, reading, userId);
    const cached = await cachedExport(key);
    if (!cached) assertRateLimit(await ratelimit('export', userId));
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
          let data = cached;
          // DESIGN-GAP: Stage-based estimates start at 25 seconds and decrease with renderer progress; they are approximate, not simulated progress.
          emit({ progress: data ? 95 : 5, estimatedSeconds: data ? 0 : 25 });
          if (!data) {
            data = await renderExport(input, reading, userId, (percent) =>
              emit({
                progress: percent,
                estimatedSeconds: Math.max(1, Math.round((100 - percent) * 0.3)),
              }),
            );
            await cacheExport(key, data, input.format);
          }
          const query = new URLSearchParams(input);
          const filename = exportFilename(input, reading);
          emit({
            progress: 100,
            url: `/api/export?${query}`,
            filename,
            estimatedSeconds: 0,
          });
        } catch (error) {
          emit({ error: error instanceof ApiError ? error.code : 'E_INTERNAL' });
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
    const input = ExportRequestSchema.parse(Object.fromEntries(query));
    const { userId, reading } = await exportReading(input);
    const key = exportKey(input, reading, userId);
    const data = await cachedExport(key);
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
        'Content-Type': exportMime(input.format),
        'Content-Disposition': `attachment; filename="${filename}"`,
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
