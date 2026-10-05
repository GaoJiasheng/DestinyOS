import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { streamMiniMax, type LlmEvent } from '../lib/llm/minimax';
import { logger } from '../lib/logger';
const messages = [
  { role: 'user' as const, content: 'Explain the supplied symbolic elements briefly.' },
];
function sse(text = 'A grounded reflection.') {
  return `data: ${JSON.stringify({ choices: [{ delta: { reasoning_content: 'private reasoning' } }] })}\r\n\r\ndata: ${JSON.stringify({ choices: [{ delta: { content: text } }] })}\r\n\r\ndata: ${JSON.stringify({ choices: [], usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 } })}\r\n\r\ndata: [DONE]\r\n\r\n`;
}
async function collect(fetcher: typeof fetch, signal?: AbortSignal, timeoutMs?: number) {
  const events: LlmEvent[] = [];
  for await (const event of streamMiniMax(messages, { fetcher, signal, timeoutMs }))
    events.push(event);
  return events;
}
beforeEach(() => {
  vi.stubEnv('MINIMAX_API_KEY', 'unit-secret-key');
  vi.stubEnv('MINIMAX_BASE_URL', 'https://api.minimaxi.com/v1');
  vi.stubEnv('MINIMAX_MODEL', 'MiniMax-M2.5');
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});
describe('MiniMax streaming boundary', () => {
  it('parses split UTF-8/CRLF SSE, ignores reasoning and logs only token counts', async () => {
    const log = vi.spyOn(logger, 'info').mockImplementation(() => undefined);
    let payload: unknown;
    const fetcher = vi.fn<typeof fetch>(async (_url, options) => {
      payload = JSON.parse(String(options?.body));
      const bytes = new TextEncoder().encode(sse('温和的方向。'));
      return new Response(
        new ReadableStream({
          start(controller) {
            for (let i = 0; i < bytes.length; i += 3) controller.enqueue(bytes.slice(i, i + 3));
            controller.close();
          },
        }),
      );
    });
    expect(await collect(fetcher)).toEqual([
      { type: 'delta', text: '温和的方向。' },
      { type: 'usage', usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 } },
    ]);
    expect(payload).toMatchObject({
      model: 'MiniMax-M2.5',
      stream: true,
      reasoning_split: true,
      stream_options: { include_usage: true },
    });
    expect(JSON.stringify(payload)).not.toContain('unit-secret-key');
    expect(log).toHaveBeenCalledExactlyOnceWith(
      { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
      'LLM token usage',
    );
  });
  it('retries a transient error once and stops after two failures', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response('', { status: 503 }))
      .mockResolvedValueOnce(new Response(sse()));
    expect(await collect(fetcher)).toHaveLength(2);
    expect(fetcher).toHaveBeenCalledTimes(2);
    fetcher.mockReset().mockResolvedValue(new Response('', { status: 429 }));
    await expect(collect(fetcher)).rejects.toThrow('LLM unavailable');
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it('does not retry credentials or a truncated stream after visible text', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response('secret provider error', { status: 401 }));
    await expect(collect(fetcher)).rejects.toThrow('LLM unavailable');
    expect(fetcher).toHaveBeenCalledOnce();
    fetcher
      .mockReset()
      .mockResolvedValue(new Response('data: {"choices":[{"delta":{"content":"partial"}}]}\n\n'));
    await expect(collect(fetcher)).rejects.toThrow('LLM unavailable');
    expect(fetcher).toHaveBeenCalledOnce();
  });
  it('timeouts bound the whole stream and an external abort prevents retry', async () => {
    const fetcher = vi.fn<typeof fetch>(
      (_url, options) =>
        new Promise((_resolve, reject) =>
          options?.signal?.addEventListener('abort', () =>
            reject(new Error('sensitive raw error')),
          ),
        ),
    );
    await expect(collect(fetcher, undefined, 10)).rejects.toThrow('LLM unavailable');
    expect(fetcher).toHaveBeenCalledTimes(2);
    fetcher.mockClear();
    const controller = new AbortController();
    const result = collect(fetcher, controller.signal);
    controller.abort();
    await expect(result).rejects.toThrow('LLM unavailable');
    expect(fetcher).toHaveBeenCalledOnce();
  });
  it('rejects missing usage, malformed events, reasoning tags and non-provider endpoints', async () => {
    for (const raw of [
      'data: {"choices":[{"delta":{"content":"hello"}}]}\n\ndata: [DONE]\n\n',
      'data: bad-json\n\n',
      sse('<think>hidden</think>'),
    ]) {
      await expect(
        collect(vi.fn<typeof fetch>().mockResolvedValue(new Response(raw))),
      ).rejects.toThrow('LLM unavailable');
    }
    vi.stubEnv('MINIMAX_BASE_URL', 'https://untrusted.example/v1');
    const fetcher = vi.fn<typeof fetch>();
    await expect(collect(fetcher)).rejects.toThrow('Invalid LLM endpoint');
    expect(fetcher).not.toHaveBeenCalled();
  });
});
// DESIGN-GAP: Smoke is the sole real-provider test; read only MiniMax variables from the ignored local file and skip without a key.
const local = existsSync('apps/web/.env.local') ? readFileSync('apps/web/.env.local', 'utf8') : '';
const smokeEnv: Record<string, string> = Object.fromEntries(
  local.split('\n').flatMap((line) => {
    const match = /^(MINIMAX_API_KEY|MINIMAX_BASE_URL|MINIMAX_MODEL)=(.*)$/.exec(line);
    return match ? [[match[1]!, match[2]!.trim().replace(/^['"]|['"]$/g, '')]] : [];
  }),
);
// Capture CI credentials before beforeEach installs mock credentials for unit cases.
for (const name of ['MINIMAX_API_KEY', 'MINIMAX_BASE_URL', 'MINIMAX_MODEL']) {
  const value = process.env[name];
  if (value) smokeEnv[name] = value;
}
it.skipIf(!smokeEnv.MINIMAX_API_KEY)(
  'real MiniMax bilingual smoke with synthetic non-identifying context',
  async () => {
    vi.stubEnv('MINIMAX_API_KEY', smokeEnv.MINIMAX_API_KEY);
    vi.stubEnv('MINIMAX_BASE_URL', smokeEnv.MINIMAX_BASE_URL ?? 'https://api.minimax.io/v1');
    vi.stubEnv('MINIMAX_MODEL', smokeEnv.MINIMAX_MODEL ?? 'MiniMax-M2.5');
    // DESIGN-GAP: Probe each locale independently, matching the app's per-locale conversations; a mixed-language request can legitimately receive only the user's English language.
    for (const locale of ['zh', 'en'] as const) {
      const events: LlmEvent[] = [];
      for await (const event of streamMiniMax([
        {
          role: 'system',
          content:
            'Use only these synthetic symbolic elements: wood and water. No personal information or professional advice. ' +
            (locale === 'zh'
              ? 'Reply only in Simplified Chinese with one brief sentence.'
              : 'Reply only in English with one brief sentence.'),
        },
        {
          role: 'user',
          content: locale === 'zh' ? '请用中文给出一句温和的思考。' : 'Give a gentle reflection.',
        },
      ]))
        events.push(event);
      const content = events
        .filter((event) => event.type === 'delta')
        .map((event) => event.text)
        .join('');
      expect(content).toMatch(locale === 'zh' ? /\p{Script=Han}/u : /[a-zA-Z]/);
      if (locale === 'en') expect(content).not.toMatch(/\p{Script=Han}/u);
      expect(events.some((event) => event.type === 'usage')).toBe(true);
    }
  },
  150000,
);
