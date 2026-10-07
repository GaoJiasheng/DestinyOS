import { openReportPage } from './platform/browser';
import { zipSync } from 'fflate';
import { printPng } from './print-png';
import type { ExportRequest } from './report-export-schema';
import type { ReadingView } from './reading-schema';
/** Render an authorized print capability in an isolated browser. */
export async function renderAuthorizedExport(
  request: ExportRequest,
  reading: Pick<ReadingView, 'system' | 'createdAt'>,
  origin: string,
  path: string,
  token: string,
  progress: (percent: number) => void,
): Promise<Uint8Array | Uint8Array[]> {
  const page = await openReportPage(origin, path, token);
  try {
    progress(10);
    await page.navigate(`${origin}${path}?theme=${request.theme}`);
    await page.validate();
    progress(30);
    if (request.format === 'pdf') {
      const pdf = await page.pdf();
      if (pdf.length > 8 * 1024 * 1024) throw new Error('PDF size budget exceeded');
      progress(90);
      return pdf;
    }
    // DESIGN-GAP: Native 2480x3508 capture with CSS zoom avoids fractional-DPR rounding (2481x3509) while retaining 300dpi vector/text rasterization.
    await page.preparePng();
    const count = request.format === 'cover' ? 1 : await page.pageCount();
    const files: Record<string, Uint8Array> = {};
    for (let i = 0; i < count; i++) {
      const screenshot = await page.screenshot(i);
      const png = await printPng(screenshot);
      if (png.length > 8 * 1024 * 1024) throw new Error('PNG size budget exceeded');
      files[
        `${reading.system}-${reading.createdAt.slice(0, 10)}-${request.locale}-${String(i + 1).padStart(2, '0')}.png`
      ] = png;
      progress(30 + Math.round(((i + 1) / count) * 60));
    }
    if (request.format === 'cover') return Object.values(files)[0]!;
    const zip = zipSync(files, { level: 0 });
    // DESIGN-GAP: Long reports exceeding the ZIP budget remain lossless 300dpi; offer individually cached PNG pages instead.
    if (zip.length > 8 * 1024 * 1024) return Object.values(files);
    return zip;
  } finally {
    await page.close();
  }
}
