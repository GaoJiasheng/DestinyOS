import { readExport, writeExport } from './platform/storage';
import { openReportPage } from './platform/browser';
import { createHmac, createHash, timingSafeEqual } from 'node:crypto';
import { brand } from '@tianji/shared/brand';
import { auth } from './auth';
import { getDb } from './db';
import { readingView } from './reading-service';
import { siteConfig } from './site-config';
import { ApiError } from './api-error';
import { canExport, EXPORT_VERSION, type ExportRequest } from './report-export-schema';
import type { ReadingView } from './reading-schema';
import { z } from 'zod';
import {
  EXPORT_TIMEOUT_MS,
  EXPORT_IMAGE_BYTES,
  EXPORT_PDF_BYTES,
  EXPORT_IMAGE_HEIGHT,
} from './report-export-schema';
import type { ReportPage } from './platform/browser';
const tokenSchema = z
  .object({
    userId: z.string(),
    readingId: z.string(),
    locale: z.enum(['zh', 'en', 'zh-TW']),
    theme: z.enum(['dark', 'light']),
    expires: z.number(),
  })
  .strict();
const sha = (value: string) => createHash('sha256').update(value).digest('hex');
const secret = () => {
  if (!process.env.AUTH_SECRET) throw new Error('Export signing secret missing');
  return process.env.AUTH_SECRET;
};
/** Sign a short-lived renderer-only capability; no private input enters a URL or browser cookie. */
// DESIGN-GAP: A five-minute HMAC capability authorizes the isolated renderer through a request header rather than forwarding the user's login cookie.
export function printToken(userId: string, request: ExportRequest): string {
  const payload = Buffer.from(
    JSON.stringify({
      userId,
      readingId: request.readingId,
      locale: request.locale,
      theme: request.theme,
      expires: Date.now() + 300000,
    }),
  ).toString('base64url');
  return `${payload}.${createHmac('sha256', secret()).update(payload).digest('base64url')}`;
}
/** Verify renderer capability, binding all route/theme/locale fields and expiry. */
export function verifyPrintToken(
  token: string,
  request: Omit<ExportRequest, 'format'>,
): string | null {
  try {
    const [payload, signature, ...extra] = token.split('.');
    if (!payload || !signature || extra.length) return null;
    const expected = createHmac('sha256', secret()).update(payload).digest();
    const actual = Buffer.from(signature, 'base64url');
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;
    const data = tokenSchema.parse(JSON.parse(Buffer.from(payload, 'base64url').toString()));
    return data.expires > Date.now() &&
      data.readingId === request.readingId &&
      data.locale === request.locale &&
      data.theme === request.theme
      ? data.userId
      : null;
  } catch {
    return null;
  }
}
/** Every print/render/download checks current login, account, ownership and export entitlement. */
export async function exportReading(
  request: ExportRequest,
  rendererUserId?: string,
): Promise<{ userId: string; reading: ReadingView }> {
  const session = rendererUserId ? null : await auth();
  const userId = rendererUserId ?? session?.user.id;
  if (!userId) throw new ApiError('E_UNAUTHORIZED', 'Sign in required', 401);
  const user = await getDb().user.findUnique({
    where: { id: userId },
    select: { plan: true, deletedAt: true },
  });
  if (!user || user.deletedAt) throw new ApiError('E_UNAUTHORIZED', 'Account unavailable', 401);
  if (!canExport(user.plan, (await siteConfig())['export.freeEnabled']))
    throw new ApiError('E_FORBIDDEN', 'Membership required', 403);
  const row = await getDb().reading.findFirst({ where: { id: request.readingId, userId } });
  if (!row) throw new ApiError('E_NOT_FOUND', 'Reading unavailable', 404);
  const reading = await readingView(row, request.locale, true);
  return { userId, reading };
}
/** Include snapshot content/version and renderer version to invalidate regenerated reports automatically. */
// DESIGN-GAP: Add owner, format and snapshot content to the requested cache identity, preventing cross-owner reuse and stale regenerated reports.
export function exportKey(request: ExportRequest, reading: ReadingView, userId: string): string {
  return sha(
    JSON.stringify([
      userId,
      reading.id,
      EXPORT_VERSION,
      reading.report.engineVersion,
      reading.report.knowledgeVersion,
      reading.report.interpretVersion,
      reading.report,
      reading.chart,
      reading.meta.schoolUsed,
      request.locale,
      request.theme,
      request.format,
      request.width,
    ]),
  );
}
/** Safe attachment name uses only system, report generation date and locale. */
export function exportFilename(request: ExportRequest, reading: ReadingView): string {
  return `${reading.system}-${reading.createdAt.slice(0, 10)}-${request.locale}${request.format === 'cover' ? '-cover' : ''}.${request.format === 'pdf' ? 'pdf' : 'jpg'}`;
}
const mime = (format: ExportRequest['format']) =>
  format === 'pdf' ? 'application/pdf' : 'image/jpeg';
/** Read a private export using the selected deployment platform. */
export const cachedExport = readExport;
/** Persist a private export with the documented TTL. */
export async function cacheExport(
  key: string,
  data: Uint8Array,
  format: ExportRequest['format'],
  contentType = mime(format),
): Promise<void> {
  await writeExport(key, data, contentType);
}
/** Render the actual authenticated print route using Chromium, with no third-party requests or private input forwarding. */
export async function renderExport(
  request: ExportRequest,
  reading: ReadingView,
  userId: string,
  progress: (percent: number) => void,
): Promise<Uint8Array> {
  const origin = new URL(
    process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : (process.env.NEXT_PUBLIC_SITE_URL ?? `https://${brand.domain}`),
  ).origin;
  const path = `/${request.locale}/${reading.system}/r/${encodeURIComponent(reading.id)}/print`;
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
    page = await openReportPage(origin, path, printToken(userId, request));
    if (expired) {
      await page.close();
      throw new ApiError('E_EXPORT_TIMEOUT', 'Export exceeded 60 seconds', 504);
    }
    progress(10);
    const layout =
      request.format === 'pdf' ? 'pdf' : request.format === 'cover' ? 'cover' : 'poster';
    await page.navigate(
      `${origin}${path}?${new URLSearchParams({ theme: request.theme, layout, width: String(request.width) })}`,
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
    let height = await page.prepareImage(request.width);
    if (height > EXPORT_IMAGE_HEIGHT && request.width === 1242)
      height = await page.prepareImage(1600);
    // DESIGN-GAP: If the wider poster is still taller than 16000px, scale its CSS geometry uniformly, preserving every block and a single fullPage capture.
    // The browser adapter performs this final geometry reduction before capture.
    if (height > EXPORT_IMAGE_HEIGHT) await page.limitImageHeight(EXPORT_IMAGE_HEIGHT);
    progress(60);
    const screenshot = await page.screenshotImage(82);
    // DESIGN-GAP: Re-encode the single capture for oversize artifacts; never capture or expose individual pages.
    const image =
      screenshot.length <= EXPORT_IMAGE_BYTES ? screenshot : await page.compressImage(screenshot);
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
export { mime as exportMime };
