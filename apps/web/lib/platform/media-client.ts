import { cloudflareBindings } from './cloudflare';
import { z } from 'zod';
/** Service-only media calls never cross a public network or forward session cookies. */
export async function mediaRequest(path: string, payload: unknown): Promise<Response> {
  const response = await (
    await cloudflareBindings()
  ).MEDIA.fetch(
    new Request(`https://media.internal${path}`, {
      method: 'POST',
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
    count: z.number().int().min(1).max(50),
    pages: z.boolean(),
  }),
  z.object({ kind: z.literal('error') }),
]);
/** Preserve real export progress across the service boundary; binary parts are bounded and private. */
export async function mediaExport(
  payload: unknown,
  progress: (percent: number) => void,
): Promise<Uint8Array | Uint8Array[]> {
  const response = await mediaRequest('/export', payload);
  const reader = response.body?.getReader();
  if (!reader) throw new Error('Missing media stream');
  const decoder = new TextDecoder();
  let pending = '';
  let result: Uint8Array | Uint8Array[] | undefined;
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
        if (event.kind === 'error') throw new Error('Media rendering failed');
        if (event.kind === 'progress') progress(event.value);
        if (event.kind === 'part') {
          if (result) throw new Error('Unexpected media part');
          const part = new Uint8Array(Buffer.from(event.data, 'base64'));
          bytes += part.byteLength;
          // DESIGN-GAP: Per-artifact frames preserve the existing 8MiB export limit; cap total private bytes at 32MiB to fit Worker memory without a giant base64 JSON object.
          if (part.byteLength > 8 * 1024 * 1024 || bytes > 32 * 1024 * 1024 || parts.length >= 50)
            throw new Error('Export stream budget exceeded');
          parts.push(part);
        }
        if (event.kind === 'result') {
          if (result || event.count !== parts.length || (!event.pages && parts.length !== 1))
            throw new Error('Invalid media result');
          result = event.pages ? parts : parts[0];
        }
        newline = pending.indexOf('\n');
      }
    }
  } finally {
    await reader.cancel();
  }
  if (!result || pending) throw new Error('Incomplete media export');
  return result;
}
