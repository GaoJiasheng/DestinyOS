import { expect, it, vi } from 'vitest';
import {
  consumeChat,
  ChatInputSchema,
  exportEndpoint,
  shareEndpoint,
  ApiClientError,
} from '../src/index';
function stream(text: string) {
  const bytes = new TextEncoder().encode(text);
  return new Response(
    new ReadableStream<Uint8Array>({
      start(controller) {
        for (let i = 0; i < bytes.length; i += bytes.length > 1000 ? 1024 : 1)
          controller.enqueue(bytes.slice(i, i + (bytes.length > 1000 ? 1024 : 1)));
        controller.close();
      },
    }),
  );
}
it('decodes single-byte chunks including split Chinese UTF-8 and a final line without newline', async () => {
  const delta = vi.fn();
  await consumeChat(
    stream('{"type":"delta","text":"你好"}\n{"type":"delta","text":" 🌟"}\n{"type":"done"}'),
    delta,
  );
  expect(delta.mock.calls.flat().join('')).toBe('你好 🌟');
});
it('rejects truncated, malformed, oversized and provider errors, rather than showing completion', async () => {
  for (const body of [
    '{"type":"delta","text":"partial"}\n',
    '{"type":"done"}\n{"type":"delta","text":"late"}\n',
    '{"type":"unknown"}\n',
    'not json\n',
    '{"type":"error","code":"E_QUOTA_EXCEEDED"}\n',
    '{"type":"delta","text":"' + 'x'.repeat(262144) + '"}\n{"type":"done"}\n',
  ]) {
    await expect(consumeChat(stream(body), () => {})).rejects.toThrow();
  }
});
it('preserves quota and owner HTTP error codes and stops cancelled consumption', async () => {
  await expect(
    consumeChat(Response.json({ error: { code: 'E_QUOTA_EXCEEDED' } }, { status: 429 }), () => {}),
  ).rejects.toMatchObject({ code: 'E_QUOTA_EXCEEDED', status: 429 });
  const controller = new AbortController();
  controller.abort();
  await expect(
    consumeChat(stream('{"type":"done"}\n'), () => {}, controller.signal),
  ).rejects.toThrow('E_CANCELLED');
  expect(new ApiClientError('E_FORBIDDEN', 403, 'api').message).not.toContain('birth');
});
it('uses the documented mobile paths and exact export/share field enums', () => {
  expect(exportEndpoint('reading-1').path).toBe('/api/v1/mobile/export/reading-1');
  expect(
    shareEndpoint('reading-1').input.parse({ locale: 'en', template: 'synastry' }).revealLevel,
  ).toBe(0);
  expect(ChatInputSchema.safeParse({ locale: 'zh', question: 'x'.repeat(121) }).success).toBe(
    false,
  );
  expect(() => exportEndpoint('../private')).toThrow();
});
