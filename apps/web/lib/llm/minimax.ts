import { z } from 'zod';
import { logger } from '../logger';

export type LlmMessage = { role: 'system' | 'user' | 'assistant'; content: string };
export type TokenUsage = { promptTokens: number; completionTokens: number; totalTokens: number };
export type LlmEvent = { type: 'delta'; text: string } | { type: 'usage'; usage: TokenUsage };
const count = z.number().int().nonnegative();
const chunkSchema = z.object({
  choices: z
    .array(
      z.object({
        delta: z.object({ content: z.string().nullable().optional() }),
        finish_reason: z.string().nullable().optional(),
      }),
    )
    .optional(),
  usage: z
    .object({ prompt_tokens: count, completion_tokens: count, total_tokens: count })
    .nullable()
    .optional(),
});
/** OpenAI-compatible SSE stream; retries once before any visible answer, never logs provider bodies or errors. */
export async function* streamMiniMax(
  messages: readonly LlmMessage[],
  options: { signal?: AbortSignal; fetcher?: typeof fetch; timeoutMs?: number } = {},
): AsyncGenerator<LlmEvent> {
  const key = process.env.MINIMAX_API_KEY;
  if (!key) throw new Error('LLM unavailable');
  const base = process.env.MINIMAX_BASE_URL ?? 'https://api.minimax.io/v1';
  // DESIGN-GAP: Restrict provider hosts so a configuration mistake cannot send context/credentials elsewhere.
  if (!/^https:\/\/api\.(minimax\.io|minimaxi\.com)\/v1\/?$/.test(base))
    throw new Error('Invalid LLM endpoint');
  const fetcher = options.fetcher ?? fetch;
  let visible = false;
  for (let attempt = 0; attempt < 2; attempt++) {
    const timeout = new AbortController();
    const timer = setTimeout(() => timeout.abort(), options.timeoutMs ?? 60000);
    const signal = options.signal
      ? AbortSignal.any([options.signal, timeout.signal])
      : timeout.signal;
    let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
    try {
      const response = await fetcher(`${base.replace(/\/$/, '')}/chat/completions`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: process.env.MINIMAX_MODEL ?? 'MiniMax-M2.5',
          messages,
          stream: true,
          stream_options: { include_usage: true },
          reasoning_split: true,
          max_tokens: 4096,
          temperature: 0.7,
        }),
        signal,
      });
      if (!response.ok || !response.body) {
        await response.body?.cancel();
        if (
          response.status === 401 ||
          response.status === 403 ||
          response.status === 400 ||
          response.status === 404
        )
          throw new NonRetryableError();
        throw new Error('LLM unavailable');
      }
      reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '',
        done = false,
        usageSeen = false,
        completed = false;
      while (!done) {
        const result = await reader.read();
        // DESIGN-GAP: The verified China endpoint closes after finish_reason + usage without a [DONE] marker.
        if (result.done) {
          if (completed && usageSeen && visible) break;
          throw new Error('Incomplete LLM stream');
        }
        buffer += decoder.decode(result.value, { stream: true }).replace(/\r/g, '');
        if (buffer.length > 1048576) throw new Error('Invalid LLM stream');
        let boundary: number;
        while ((boundary = buffer.indexOf('\n\n')) !== -1) {
          const event = buffer.slice(0, boundary);
          buffer = buffer.slice(boundary + 2);
          const data = event
            .split('\n')
            .filter((line) => line.startsWith('data:'))
            .map((line) => line.slice(5).trim())
            .join('\n');
          if (!data) continue;
          if (data === '[DONE]') {
            done = true;
            break;
          }
          const chunk = chunkSchema.parse(JSON.parse(data));
          if (chunk.choices?.[0]?.finish_reason === 'stop') completed = true;
          const text = chunk.choices?.[0]?.delta.content;
          if (text) {
            // reasoning_split keeps chain of thought out of content; fail closed if provider ignores it.
            if (/<\/?think>/i.test(text)) throw new NonRetryableError();
            visible = true;
            yield { type: 'delta', text };
          }
          if (chunk.usage) {
            const usage = {
              promptTokens: chunk.usage.prompt_tokens,
              completionTokens: chunk.usage.completion_tokens,
              totalTokens: chunk.usage.total_tokens,
            };
            logger.info(usage, 'LLM token usage');
            usageSeen = true;
            yield { type: 'usage', usage };
          }
        }
      }
      if (!visible || !usageSeen) throw new Error('Incomplete LLM stream');
      return;
    } catch (error) {
      if (attempt === 1 || visible || options.signal?.aborted || error instanceof NonRetryableError)
        throw new Error('LLM unavailable');
      // DESIGN-GAP: Retry transient network/5xx/429/timeout failures once; no retry after visible output to avoid duplicate answers.
    } finally {
      clearTimeout(timer);
      await reader?.cancel().catch(() => undefined);
      reader?.releaseLock();
    }
  }
}
class NonRetryableError extends Error {}
