import { openReportPage, type ReportPage } from './platform/browser';
import { ApiError } from './api-error-core';
import {
  EXPORT_TIMEOUT_MS,
  EXPORT_IMAGE_BYTES,
  EXPORT_IMAGE_TARGET_BYTES,
  EXPORT_PDF_BYTES,
  EXPORT_IMAGE_HEIGHT,
  type ExportRequest,
} from './report-export-schema';
/** Render a single A4-width poster or compact searchable PDF from an authorized print capability. */
export async function renderAuthorizedExport(
  request: ExportRequest,
  origin: string,
  path: string,
  token: string,
  progress: (percent: number) => void,
): Promise<Uint8Array> {
  let page: ReportPage | undefined;
  let expired = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      expired = true;
      reject(new ApiError('E_EXPORT_TIMEOUT', 'Export exceeded 60 seconds', 504));
    }, EXPORT_TIMEOUT_MS);
  });
  const render = async () => {
    page = await openReportPage(origin, path, token);
    if (expired) {
      await page.close();
      throw new ApiError('E_EXPORT_TIMEOUT', 'Export exceeded 60 seconds', 504);
    }
    progress(10);
    const layout =
      request.format === 'pdf' ? 'pdf' : request.format === 'cover' ? 'cover' : 'poster';
    await page.navigate(
      `${origin}${path}?${new URLSearchParams({ theme: request.theme, layout })}`,
    );
    await page.validate();
    progress(40);
    if (request.format === 'pdf') {
      const pdf = await page.pdf();
      if (pdf.length > EXPORT_PDF_BYTES)
        throw new ApiError('E_EXPORT_SIZE', 'PDF size budget exceeded', 422);
      progress(90);
      return pdf;
    }
    const height = await page.prepareImage();
    if (height > EXPORT_IMAGE_HEIGHT) {
      const scaledHeight = await page.limitImageHeight(EXPORT_IMAGE_HEIGHT);
      // DESIGN-GAP: JPEG quality cannot reduce pixel height; reject content that cannot fit at the 9pt floor rather than crop, paginate or widen it.
      if (scaledHeight > EXPORT_IMAGE_HEIGHT)
        throw new ApiError('E_EXPORT_SIZE', 'Image height exceeds the readable A4 budget', 422);
    }
    progress(60);
    const screenshot = await page.screenshotImage(82);
    // DESIGN-GAP: Re-encode the single capture for oversize artifacts; never capture or expose individual pages.
    const image =
      screenshot.length <= EXPORT_IMAGE_TARGET_BYTES
        ? screenshot
        : await page.compressImage(screenshot);
    if (image.length > EXPORT_IMAGE_BYTES)
      throw new ApiError('E_EXPORT_SIZE', 'Image size budget exceeded', 422);
    progress(90);
    return image;
  };
  try {
    return await Promise.race([render(), timeout]);
  } finally {
    clearTimeout(timer);
    if (page) {
      if (expired) void page.close().catch(() => undefined);
      else await page.close();
    }
  }
}
