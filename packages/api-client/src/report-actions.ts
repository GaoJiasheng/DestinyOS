import { z } from 'zod';
import { ApiClientError } from './error';
import { mobileEndpoint } from './mobile';
const readingId = z.string().regex(/^[A-Za-z0-9-]{1,64}$/);
export const ChatInputSchema = z
  .object({ locale: z.enum(['zh', 'en', 'zh-TW']), question: z.string().trim().min(1).max(120) })
  .strict();
export const ChatHistorySchema = z.object({
  available: z.boolean(),
  remaining: z.number().int().nonnegative(),
  limit: z.number().int().nonnegative(),
  messages: z
    .array(
      z.object({
        id: z.string(),
        role: z.enum(['user', 'assistant']),
        content: z.string(),
        createdAt: z.string(),
      }),
    )
    .max(500),
});
export const ChatEventSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('delta'), text: z.string() }),
  z.object({ type: z.literal('done') }),
  z.object({ type: z.literal('error'), code: z.string() }),
]);
export const chatEndpoint = (id: string) =>
  mobileEndpoint(`chat/${readingId.parse(id)}`, 'GET', z.object({}), ChatHistorySchema);
export const deleteChatEndpoint = (id: string) =>
  mobileEndpoint(`chat/${readingId.parse(id)}`, 'DELETE', z.object({}), z.object({}));
export const ExportInputSchema = z
  .object({
    locale: z.enum(['zh', 'en', 'zh-TW']),
    theme: z.enum(['dark', 'light']),
    format: z.enum(['pdf', 'png', 'cover']),
  })
  .strict();
const file = z.object({ url: z.string(), filename: z.string().regex(/^[A-Za-z0-9_.-]+$/) });
export const exportEndpoint = (id: string) =>
  mobileEndpoint(
    `export/${readingId.parse(id)}`,
    'POST',
    ExportInputSchema,
    file.extend({ files: z.array(file).min(1).max(80), expiresIn: z.number() }),
  );
export const ShareInputSchema = z
  .object({
    template: z.enum(['chart', 'quote', 'daily', 'synastry']),
    revealLevel: z.number().int().min(0).max(2).default(0),
    expiresIn: z.union([z.literal(7), z.literal(30)]).optional(),
    locale: z.enum(['zh', 'en', 'zh-TW']),
  })
  .strict();
export const shareEndpoint = (id: string) =>
  mobileEndpoint(
    `share/${readingId.parse(id)}`,
    'POST',
    ShareInputSchema,
    z.object({ token: z.string().regex(/^[A-Za-z0-9]{22}$/), url: z.string().url() }),
  );
/** Decode bounded NDJSON incrementally, preserving split UTF-8 and requiring a terminal event. */
export async function consumeChat(
  response: Response,
  onDelta: (text: string) => void,
  signal?: AbortSignal,
) {
  if (!response.ok) {
    const raw: unknown = await response.json();
    const failure = z.object({ error: z.object({ code: z.string() }) }).safeParse(raw);
    throw new ApiClientError(
      failure.success ? failure.data.error.code : 'E_INTERNAL',
      response.status,
      'api',
    );
  }
  const reader = response.body?.getReader();
  if (!reader) throw new ApiClientError('E_INTERNAL', 0, 'decode');
  const decoder = new TextDecoder();
  let buffer = '',
    done = false,
    total = 0;
  const line = (value: string) => {
    if (!value.trim()) return;
    if (done) throw new ApiClientError('E_INTERNAL', 0, 'decode');
    const event = ChatEventSchema.parse(JSON.parse(value));
    if (event.type === 'error') throw new ApiClientError(event.code, 0, 'api');
    if (event.type === 'done') done = true;
    else onDelta(event.text);
  };
  try {
    while (true) {
      if (signal?.aborted) throw new Error('E_CANCELLED');
      const chunk = await reader.read();
      if (chunk.done) break;
      total += chunk.value.length;
      // DESIGN-GAP: Bound native streamed answers to 256 KiB; reject truncated protocols instead of presenting them as completed replies.
      if (total > 262144) throw new ApiClientError('E_INTERNAL', 0, 'decode');
      buffer += decoder.decode(chunk.value, { stream: true });
      let index: number;
      while ((index = buffer.indexOf('\n')) >= 0) {
        line(buffer.slice(0, index));
        buffer = buffer.slice(index + 1);
      }
    }
    buffer += decoder.decode();
    line(buffer);
    if (!done) throw new ApiClientError('E_INTERNAL', 0, 'decode');
  } finally {
    await reader.cancel();
    reader.releaseLock();
  }
}
