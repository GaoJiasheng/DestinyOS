import { afterEach, expect, it, vi } from 'vitest';
import type { ReportPage } from '../lib/platform/browser';
import type { MediaEnvironment } from '../workers/media-context';
vi.mock('../lib/platform/browser', () => ({ openReportPage: vi.fn() }));
vi.mock('../lib/og-card-render', () => ({ renderCard: vi.fn() }));
vi.mock('../lib/public-og-template', () => ({ renderPublicOgTemplate: vi.fn() }));
import { openReportPage } from '../lib/platform/browser';
import media from '../workers/media';
const env = { NEXT_PUBLIC_SITE_URL: 'https://tianji.gavin.pub' } as MediaEnvironment;
const payload = {
  request: { readingId: 'r-example', locale: 'zh', theme: 'dark', format: 'png' },
  reading: { system: 'bazi', createdAt: '2026-10-07T00:00:00Z' },
  origin: 'https://tianji.gavin.pub',
  path: '/zh/bazi/r/r-example/print',
  token: 'private-print-capability',
};
function renderer(): ReportPage {
  return {
    navigate: vi.fn().mockResolvedValue(undefined),
    validate: vi.fn().mockResolvedValue(undefined),
    pdf: vi.fn().mockResolvedValue(new TextEncoder().encode('%PDF-test')),
    prepareImage: vi.fn().mockResolvedValue(12000),
    limitImageHeight: vi.fn().mockResolvedValue(15998),
    compressImage: vi.fn().mockResolvedValue(new Uint8Array(2000000)),
    screenshotImage: vi.fn().mockResolvedValue(new Uint8Array([255, 216, 255, 217])),
    close: vi.fn().mockResolvedValue(undefined),
  };
}
async function response(format = 'png') {
  return media.fetch(
    new Request('https://media.internal/export', {
      method: 'POST',
      body: JSON.stringify({ ...payload, request: { ...payload.request, format } }),
    }),
    env,
  );
}
async function events(response: Response): Promise<unknown[]> {
  return (await response.text())
    .trim()
    .split('\n')
    .map((line) => JSON.parse(line) as unknown);
}
afterEach(() => {
  vi.useRealTimers();
  vi.resetAllMocks();
});
it.each(['png', 'cover', 'pdf'])(
  'media renders %s as one private artifact using the new layout',
  async (format) => {
    const page = renderer();
    vi.mocked(openReportPage).mockResolvedValue(page);
    const result = await response(format);
    expect(result.headers.get('Cache-Control')).toBe('private, no-store');
    const frames = await events(result);
    expect(frames.at(-1)).toEqual({ kind: 'result', pages: false, count: 1 });
    expect(
      frames.filter((frame) => typeof frame === 'object' && frame !== null && 'data' in frame),
    ).toHaveLength(1);
    expect(page.navigate).toHaveBeenCalledWith(
      expect.stringContaining(`layout=${format === 'png' ? 'poster' : format}`),
    );
    if (format === 'pdf') {
      expect(page.pdf).toHaveBeenCalledOnce();
      expect(page.screenshotImage).not.toHaveBeenCalled();
    } else expect(page.screenshotImage).toHaveBeenCalledExactlyOnceWith(82);
    expect(page.close).toHaveBeenCalledOnce();
  },
);
it('media streams the size error and closes the browser rather than returning an oversized PDF', async () => {
  const page = renderer();
  vi.mocked(page.pdf).mockResolvedValue(new Uint8Array(2000001));
  vi.mocked(openReportPage).mockResolvedValue(page);
  expect((await events(await response('pdf'))).at(-1)).toEqual({
    kind: 'error',
    code: 'E_EXPORT_SIZE',
  });
  expect(page.close).toHaveBeenCalledOnce();
});
it('media streams the unchanged 60-second timeout and closes a stalled browser', async () => {
  vi.useFakeTimers();
  const page = renderer();
  vi.mocked(page.navigate).mockReturnValue(new Promise(() => undefined));
  vi.mocked(openReportPage).mockResolvedValue(page);
  const frames = events(await response());
  await vi.advanceTimersByTimeAsync(60000);
  expect((await frames).at(-1)).toEqual({ kind: 'error', code: 'E_EXPORT_TIMEOUT' });
  expect(page.close).toHaveBeenCalledOnce();
});

it('cancelling the service stream still lets the renderer deadline close the browser', async () => {
  vi.useFakeTimers();
  const page = renderer();
  vi.mocked(page.navigate).mockReturnValue(new Promise(() => undefined));
  vi.mocked(openReportPage).mockResolvedValue(page);
  const result = await response();
  await result.body?.cancel();
  await vi.advanceTimersByTimeAsync(60000);
  expect(page.close).toHaveBeenCalledOnce();
});
