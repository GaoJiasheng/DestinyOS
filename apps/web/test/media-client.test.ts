import { afterEach, expect, it, vi } from 'vitest';
const { fetchMedia } = vi.hoisted(() => ({
  fetchMedia: vi.fn<(request: Request) => Promise<Response>>(),
}));
vi.mock('../lib/platform/cloudflare', () => ({
  cloudflareBindings: async () => ({ MEDIA: { fetch: fetchMedia } }),
}));
import { mediaExport, convertSubmittedText } from '../lib/platform/media-client';
afterEach(() => vi.resetAllMocks());
function stream(events: ReadonlyArray<Record<string, unknown>>) {
  const data = events.map((event) => JSON.stringify(event) + '\n').join('');
  return new Response(
    new ReadableStream<Uint8Array>({
      start(controller) {
        for (const chunk of [data.slice(0, 7), data.slice(7, 23), data.slice(23)])
          controller.enqueue(new TextEncoder().encode(chunk));
        controller.close();
      },
    }),
  );
}
const part = (text: string) => ({ kind: 'part', data: Buffer.from(text).toString('base64') });
it('preserves fragmented progress and private binary artifacts across the service binding', async () => {
  fetchMedia.mockResolvedValue(
    stream([
      { kind: 'progress', value: 10 },
      part('%PDF-local'),
      { kind: 'progress', value: 90 },
      { kind: 'result', count: 1, pages: false },
    ]),
  );
  const progress = vi.fn();
  expect(await mediaExport({ token: 'capability' }, progress)).toEqual(
    new TextEncoder().encode('%PDF-local'),
  );
  expect(progress.mock.calls).toEqual([[10], [90]]);
  const request = fetchMedia.mock.calls[0]![0];
  expect(request.url).toBe('https://media.internal/export');
  expect(request.headers.has('cookie')).toBe(false);
  expect(await request.json()).toEqual({ token: 'capability' });
});
it('returns separate PNG pages and rejects incomplete, out-of-order or failed streams', async () => {
  fetchMedia.mockResolvedValueOnce(
    stream([part('page-a'), part('page-b'), { kind: 'result', count: 2, pages: true }]),
  );
  expect(await mediaExport({}, () => {})).toEqual(
    ['page-a', 'page-b'].map((value) => new TextEncoder().encode(value)),
  );
  for (const events of [
    [part('a')],
    [part('a'), { kind: 'result', count: 2, pages: true }],
    [part('a'), { kind: 'result', count: 1, pages: false }, part('late')],
    [{ kind: 'error' }],
  ]) {
    fetchMedia.mockResolvedValueOnce(stream(events));
    await expect(mediaExport({}, () => {})).rejects.toThrow();
  }
});
it('rejects a binary artifact beyond the existing 8MiB limit', async () => {
  fetchMedia.mockResolvedValue(
    stream([{ kind: 'part', data: Buffer.alloc(8 * 1024 * 1024 + 1).toString('base64') }]),
  );
  await expect(mediaExport({}, () => {})).rejects.toThrow('budget exceeded');
});
it('uses the full conversion service only for explicitly submitted text', async () => {
  fetchMedia.mockResolvedValue(Response.json({ text: '測試' }));
  expect(await convertSubmittedText('测试')).toBe('測試');
  const request = fetchMedia.mock.calls[0]![0];
  expect(request.url).toBe('https://media.internal/traditional');
  expect(await request.json()).toEqual({ text: '测试' });
});
