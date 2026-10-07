import { afterEach, expect, it, vi } from 'vitest';
import { ExportRequestSchema } from '../lib/report-export-schema';
import type { ReportPage } from '../lib/platform/browser';
import { baziReading } from './fixtures/bazi-reading';
vi.mock('../lib/auth', () => ({ auth: vi.fn() }));
vi.mock('../lib/platform/browser', () => ({ openReportPage: vi.fn() }));
import { openReportPage } from '../lib/platform/browser';
import { renderExport } from '../lib/report-export';
const input = ExportRequestSchema.parse({ readingId: 'r-example', locale: 'zh', format: 'png' });
function renderer(): ReportPage {
  return {
    navigate: vi.fn().mockResolvedValue(undefined),
    validate: vi.fn().mockResolvedValue(undefined),
    pdf: vi.fn().mockResolvedValue(new Uint8Array(100)),
    prepareImage: vi.fn().mockResolvedValue(18000),
    limitImageHeight: vi.fn().mockResolvedValue(undefined),
    compressImage: vi.fn().mockResolvedValue(new Uint8Array(2000000)),
    screenshotImage: vi.fn().mockResolvedValue(new Uint8Array(3100000)),
    close: vi.fn().mockResolvedValue(undefined),
  };
}
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});
it('captures a tall report once, widens it and compresses the single artifact', async () => {
  vi.stubEnv('AUTH_SECRET', 'export-render-secret');
  const page = renderer();
  vi.mocked(openReportPage).mockResolvedValue(page);
  const result = await renderExport(input, baziReading('zh'), 'owner', vi.fn());
  expect(page.prepareImage).toHaveBeenNthCalledWith(1, 1242);
  expect(page.prepareImage).toHaveBeenNthCalledWith(2, 1600);
  expect(page.limitImageHeight).toHaveBeenCalledWith(16000);
  expect(page.screenshotImage).toHaveBeenCalledExactlyOnceWith(82);
  expect(page.compressImage).toHaveBeenCalledOnce();
  expect(result.length).toBeLessThanOrEqual(3000000);
  expect(page.close).toHaveBeenCalledOnce();
});
it('closes a stalled renderer and reports the whole-operation 60-second deadline', async () => {
  vi.useFakeTimers();
  vi.stubEnv('AUTH_SECRET', 'export-render-secret');
  const page = renderer();
  vi.mocked(page.navigate).mockReturnValue(new Promise(() => undefined));
  vi.mocked(openReportPage).mockResolvedValue(page);
  const pending = renderExport(input, baziReading('zh'), 'owner', vi.fn());
  const failure = expect(pending).rejects.toMatchObject({ code: 'E_EXPORT_TIMEOUT', status: 504 });
  await vi.advanceTimersByTimeAsync(60000);
  await failure;
  expect(page.close).toHaveBeenCalledOnce();
  expect(page.screenshotImage).not.toHaveBeenCalled();
});
it('rejects oversized PDFs while leaving their text as browser-generated PDF', async () => {
  vi.stubEnv('AUTH_SECRET', 'export-render-secret');
  const page = renderer();
  vi.mocked(page.pdf).mockResolvedValue(new Uint8Array(2000001));
  vi.mocked(openReportPage).mockResolvedValue(page);
  await expect(
    renderExport({ ...input, format: 'pdf' }, baziReading('zh'), 'owner', vi.fn()),
  ).rejects.toMatchObject({ code: 'E_EXPORT_SIZE' });
  expect(page.screenshotImage).not.toHaveBeenCalled();
  expect(page.close).toHaveBeenCalledOnce();
});
