import { z } from 'zod';
import { ApiError, errorResponse } from '@/lib/api-error';
import { chatHistory, deleteChat, prepareChat } from '@/lib/chat-service';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 150;
type Context = { params: Promise<{ id: string }> };
function failure(error: unknown) {
  return errorResponse(
    error instanceof ApiError
      ? error
      : new ApiError(
          error instanceof z.ZodError || error instanceof SyntaxError
            ? 'E_VALIDATION'
            : 'E_INTERNAL',
          'Chat unavailable',
          error instanceof z.ZodError || error instanceof SyntaxError ? 400 : 503,
        ),
  );
}
/** Owner-only dialogue and availability; never cache private history. */
export async function GET(_request: Request, context: Context) {
  try {
    return Response.json(
      { ok: true, data: await chatHistory((await context.params).id) },
      { headers: { 'Cache-Control': 'private, no-store' } },
    );
  } catch (error) {
    return failure(error);
  }
}
/** Delete all saved dialogue for one owned reading; leave daily counters intact. */
export async function DELETE(request: Request, context: Context) {
  if (request.headers.get('origin') !== new URL(request.url).origin)
    return errorResponse(new ApiError('E_FORBIDDEN', 'Invalid origin', 403));
  try {
    await deleteChat((await context.params).id);
    return Response.json({ ok: true, data: {} });
  } catch (error) {
    return failure(error);
  }
}
/** Stream NDJSON delta/done/error events after validating same-origin input and reserving quota. */
export async function POST(request: Request, context: Context) {
  if (request.headers.get('origin') !== new URL(request.url).origin)
    return errorResponse(new ApiError('E_FORBIDDEN', 'Invalid origin', 403));
  try {
    if (!request.headers.get('content-type')?.startsWith('application/json'))
      throw new ApiError('E_VALIDATION', 'JSON required', 400);
    // DESIGN-GAP: B-05 has no transport path/protocol; use the API v1 reading namespace and bounded NDJSON events.
    if (Number(request.headers.get('content-length') ?? 0) > 12000)
      throw new ApiError('E_VALIDATION', 'Request too large', 400);
    const body = await request.text();
    if (body.length > 12000) throw new ApiError('E_VALIDATION', 'Request too large', 400);
    const abort = new AbortController();
    const signal = AbortSignal.any([request.signal, abort.signal]);
    const iterator = await prepareChat((await context.params).id, JSON.parse(body), signal);
    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      async pull(controller) {
        try {
          const next = await iterator.next();
          if (next.done) controller.close();
          else controller.enqueue(encoder.encode(JSON.stringify(next.value) + '\n'));
        } catch {
          controller.error(new Error('Chat unavailable'));
        }
      },
      async cancel() {
        abort.abort();
        await iterator.return();
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
    return failure(error);
  }
}
