import { cloudflareBindings } from './cloudflare';
import { z } from 'zod';
import { ApiError } from '../api-error-core';
import { EXPORT_TIMEOUT_MS } from '../report-export-schema';
/** Service-only media calls never cross a public network or forward session cookies. */
export async function mediaRequest(
  path: string,
  payload: unknown,
  signal?: AbortSignal,
): Promise<Response> {
  const response = await (
    await cloudflareBindings()
  ).MEDIA.fetch(
    new Request(`https://media.internal${path}`, {
      method: 'POST',
      signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }),
  );
  if (!response.ok) throw new Error('Media service unavailable');
  return response;
}
/** Free submitted prose, when conversion is requested, uses full OpenCC only in the child service. */
export async function convertSubmittedText(text: string): Promise<string> {
  const response = await mediaRequest('/traditional', { text });
  return z
    .object({ text: z.string() })
    .strict()
    .parse(await response.json()).text;
}
const eventSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('progress'), value: z.number().min(0).max(100) }),
  z.object({ kind: z.literal('part'), data: z.string().max(12 * 1024 * 1024) }),
  z.object({
    kind: z.literal('result'),
    count: z.literal(1),
    pages: z.literal(false),
  }),
  z.object({
    kind: z.literal('error'),
    code: z.enum(['E_EXPORT_TIMEOUT', 'E_EXPORT_SIZE', 'E_INTERNAL']).default('E_INTERNAL'),
  }),
]);
/** Preserve real export progress across the service boundary; binary parts are bounded and private. */
async function readMediaExport(
  payload: unknown,
  progress: (percent: number) => void,
  signal: AbortSignal,
): Promise<Uint8Array> {
  const response = await mediaRequest('/export', payload, signal);
  const reader = response.body?.getReader();
  if (!reader) throw new Error('Missing media stream');
  const cancel = () => {
    void reader.cancel().catch(() => undefined);
  };
  signal.addEventListener('abort', cancel, { once: true });
  if (signal.aborted) cancel();
  const decoder = new TextDecoder();
  let pending = '';
  let result: Uint8Array | undefined;
  const parts: Uint8Array[] = [];
  let bytes = 0;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      pending += decoder.decode(value, { stream: true });
      if (pending.length > 12 * 1024 * 1024) throw new Error('Export stream budget exceeded');
      let newline = pending.indexOf('\n');
      while (newline >= 0) {
        const event = eventSchema.parse(JSON.parse(pending.slice(0, newline)));
        pending = pending.slice(newline + 1);
        if (event.kind === 'error')
          throw new ApiError(
            event.code,
            'Media rendering failed',
            event.code === 'E_EXPORT_TIMEOUT' ? 504 : event.code === 'E_EXPORT_SIZE' ? 422 : 500,
          );
        if (event.kind === 'progress') progress(event.value);
        if (event.kind === 'part') {
          if (result) throw new Error('Unexpected media part');
          const part = new Uint8Array(Buffer.from(event.data, 'base64'));
          bytes += part.byteLength;
          // DESIGN-GAP: One bounded private frame retains transport headroom; format-specific budgets are enforced by the renderer.
          if (part.byteLength > 8 * 1024 * 1024 || bytes > 32 * 1024 * 1024 || parts.length >= 1)
            throw new Error('Export stream budget exceeded');
          parts.push(part);
        }
        if (event.kind === 'result') {
          if (result || event.count !== parts.length || (!event.pages && parts.length !== 1))
            throw new Error('Invalid media result');
          result = parts[0];
        }
        newline = pending.indexOf('\n');
      }
    }
  } finally {
    signal.removeEventListener('abort', cancel);
    await reader.cancel();
  }
  if (!result || pending) throw new Error('Incomplete media export');
  return result;
}

/** Bound the complete service call, including opening the renderer and receiving its artifact. */
export async function mediaExport(
  payload: unknown,
  progress: (percent: number) => void,
): Promise<Uint8Array> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const abort = new AbortController();
  // DESIGN-GAP: A second deadline covers stalled service transport; the media renderer owns browser cleanup.
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new ApiError('E_EXPORT_TIMEOUT', 'Export exceeded 60 seconds', 504));
      abort.abort();
    }, EXPORT_TIMEOUT_MS);
  });
  try {
    return await Promise.race([readMediaExport(payload, progress, abort.signal), timeout]);
  } finally {
    clearTimeout(timer);
  }
}
