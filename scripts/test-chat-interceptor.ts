import { z } from 'zod';
// DESIGN-GAP: E2E preloads intercept only isolated credentials; application code always uses the actual provider protocol.
if (process.env.TEST_CHAT_MOCK !== '1' || process.env.MINIMAX_API_KEY !== 'isolated-chat-key')
  throw new Error('Chat interception requires isolated credentials');
const original = globalThis.fetch.bind(globalThis);
const payloadSchema = z.object({
  model: z.string(),
  stream: z.literal(true),
  reasoning_split: z.literal(true),
  messages: z.array(z.object({ role: z.string(), content: z.string() })),
});
globalThis.fetch = async (input, init) => {
  const url = new URL(input instanceof Request ? input.url : String(input));
  if (!['api.minimaxi.com', 'api.minimax.io'].includes(url.hostname)) return original(input, init);
  const payload = payloadSchema.parse(JSON.parse(String(init?.body)));
  if (
    url.pathname !== '/v1/chat/completions' ||
    /PrivateName|1990-05-15|1990年5月15日|Beijing|北京|private-chat@example.com|2448026/.test(
      JSON.stringify(payload),
    )
  )
    throw new Error('Unexpected private provider payload');
  const last = payload.messages.at(-1)?.content ?? '';
  if (last.includes('Failure probe')) return new Response('', { status: 503 });
  const zh = payload.messages[0]?.content.includes('Response language: zh');
  const text = zh
    ? '从给定报告来看，木象征成长与适应。你可以回顾自己在哪些情境中愿意主动学习。命盘只能提供反思的方向，不能确定现实结果。保留这种不确定性，让自己的实际体验帮助你判断。'.repeat(
        4,
      )
    : 'The supplied chart describes a tendency toward growth and adaptability. You could reflect on situations where learning feels natural and compare that theme with your own experience. This symbolic reading offers a perspective rather than a certain outcome. '.repeat(
        6,
      );
  const encoder = new TextEncoder();
  let index = 0,
    cancelled = false;
  const body = new ReadableStream<Uint8Array>({
    async pull(controller) {
      await new Promise<void>((resolve) =>
        setTimeout(resolve, last.includes('Slow probe') ? 500 : 25),
      );
      if (cancelled || init?.signal?.aborted) {
        controller.error(new Error('Cancelled mock stream'));
        return;
      }
      if (index < text.length) {
        const content = text.slice(index, index + 24);
        index += 24;
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ choices: [{ delta: { content } }] })}\n\n`),
        );
      } else {
        controller.enqueue(
          encoder.encode(
            'data: {"choices":[{"delta":{},"finish_reason":"stop"}]}\n\ndata: {"choices":[],"usage":{"prompt_tokens":120,"completion_tokens":40,"total_tokens":160}}\n\n',
          ),
        );
        controller.close();
      }
    },
    cancel() {
      cancelled = true;
    },
  });
  return new Response(body, { headers: { 'Content-Type': 'text/event-stream' } });
};
