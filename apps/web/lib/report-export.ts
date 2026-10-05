import { createHmac, createHash, timingSafeEqual, randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile, stat, unlink, readdir, rename } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium } from 'playwright-core';
import { zipSync } from 'fflate';
import { get, head, put, del } from '@vercel/blob';
import { brand } from '@tianji/shared/brand';
import { auth } from './auth';
import { getDb } from './db';
import { readingView } from './reading-service';
import { siteConfig } from './site-config';
import { ApiError } from './api-error';
import { canExport, EXPORT_TTL, EXPORT_VERSION, type ExportRequest } from './report-export-schema';
import type { ReadingView } from './reading-schema';
import { z } from 'zod';
import { printPng } from './print-png';
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
    ]),
  );
}
/** Safe attachment name uses only system, report generation date and locale. */
export function exportFilename(request: ExportRequest, reading: ReadingView): string {
  return `${reading.system}-${reading.createdAt.slice(0, 10)}-${request.locale}${request.format === 'cover' ? '-cover' : ''}.${request.format === 'pdf' ? 'pdf' : request.format === 'cover' ? 'png' : 'zip'}`;
}
const directory = join(tmpdir(), 'destinyos-report-export');
const mime = (format: ExportRequest['format']) =>
  format === 'pdf' ? 'application/pdf' : format === 'cover' ? 'image/png' : 'application/zip';
const blobPath = (key: string) => `report-exports/${key}`;
/** Read only unexpired private artifacts; local temporary storage is used without a Blob token. */
export async function cachedExport(key: string): Promise<Uint8Array | null> {
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    try {
      const metadata = await head(blobPath(key));
      if (Date.now() - metadata.uploadedAt.getTime() > EXPORT_TTL * 1000) {
        await del(metadata.url);
        return null;
      }
      const result = await get(metadata.url, { access: 'private' });
      if (!result || result.statusCode !== 200) return null;
      return new Uint8Array(await new Response(result.stream).arrayBuffer());
    } catch (error) {
      if (error instanceof Error && error.name === 'BlobNotFoundError') return null;
      throw error;
    }
  }
  try {
    const path = join(directory, key);
    const metadata = await stat(path);
    if (Date.now() - metadata.mtimeMs > EXPORT_TTL * 1000) {
      await unlink(path);
      return null;
    }
    return await readFile(path);
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return null;
    throw error;
  }
}
/** Persist private artifacts atomically and opportunistically remove expired local exports. */
// DESIGN-GAP: Without private Blob credentials, local artifacts use owner-process-only files, UUID temporary writes and opportunistic expiry cleanup.
export async function cacheExport(
  key: string,
  data: Uint8Array,
  format: ExportRequest['format'],
  contentType = mime(format),
): Promise<void> {
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    await put(blobPath(key), Buffer.from(data), {
      access: 'private',
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType,
    });
    return;
  }
  await mkdir(directory, { recursive: true, mode: 0o700 });
  for (const name of await readdir(directory)) {
    const path = join(directory, name);
    try {
      if (Date.now() - (await stat(path)).mtimeMs > EXPORT_TTL * 1000) await unlink(path);
    } catch {
      /* Concurrent cleanup can remove a stale file first. */
    }
  }
  const path = join(directory, key),
    temporary = path + `.${randomUUID()}.tmp`;
  await writeFile(temporary, data, { mode: 0o600 });
  await rename(temporary, path);
}
/** Render the actual authenticated print route using Chromium, with no third-party requests or private input forwarding. */
export async function renderExport(
  request: ExportRequest,
  reading: ReadingView,
  userId: string,
  progress: (percent: number) => void,
): Promise<Uint8Array | Uint8Array[]> {
  const serverless = Boolean(process.env.VERCEL);
  // DESIGN-GAP: The web package requires Node >=22.17 for the pinned serverless Chromium; Vercel selects a supported LTS runtime from that engine range.
  const executable = serverless ? await import('@sparticuz/chromium') : null;
  const browser = await chromium.launch(
    executable
      ? {
          args: executable.default.args,
          executablePath: await executable.default.executablePath(),
          headless: true,
        }
      : { headless: true },
  );
  try {
    // DESIGN-GAP: Use the configured canonical app origin, never a client-supplied URL or Host header; preview deployments use VERCEL_URL.
    const origin = new URL(
      process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : (process.env.NEXT_PUBLIC_SITE_URL ?? `https://${brand.domain}`),
    ).origin;
    const path = `/${request.locale}/${reading.system}/r/${encodeURIComponent(reading.id)}/print`;
    const context = await browser.newContext({
      viewport: { width: 794, height: 1123 },
      deviceScaleFactor: 1,
      reducedMotion: 'reduce',
      serviceWorkers: 'block',
    });
    await context.route('**/*', async (route) => {
      const url = new URL(route.request().url());
      if (url.origin !== origin && url.protocol !== 'data:') return route.abort();
      const headers = route.request().headers();
      if (url.pathname === path) headers['x-report-print-token'] = printToken(userId, request);
      if (process.env.VERCEL_AUTOMATION_BYPASS_SECRET)
        headers['x-vercel-protection-bypass'] = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
      return route.continue({ headers });
    });
    const page = await context.newPage();
    progress(10);
    const response = await page.goto(`${origin}${path}?theme=${request.theme}`, {
      waitUntil: 'networkidle',
      timeout: 60000,
    });
    if (!response?.ok()) throw new Error('Print route unavailable');
    await page.waitForFunction(
      () =>
        ['true', 'error'].includes(
          document.querySelector('.print-report')?.getAttribute('data-ready') ?? '',
        ),
      {},
      { timeout: 60000 },
    );
    if ((await page.locator('.print-report').getAttribute('data-ready')) !== 'true')
      throw new Error('Print pagination failed');
    // DESIGN-GAP: CSS measurements are fractional pixels; permit one CSS pixel of rounding, never hidden overflow.
    const invalid = await page
      .locator('.print-page-content')
      .evaluateAll((nodes) => nodes.some((n) => n.scrollHeight > n.clientHeight + 1));
    if (invalid) throw new Error('Print content overflow');
    progress(30);
    if (request.format === 'pdf') {
      await page.emulateMedia({ media: 'print' });
      const pdf = await page.pdf({
        format: 'A4',
        printBackground: true,
        preferCSSPageSize: true,
        tagged: true,
      });
      if (pdf.length > 8 * 1024 * 1024) throw new Error('PDF size budget exceeded');
      progress(90);
      return pdf;
    }
    // DESIGN-GAP: Native 2480x3508 capture with CSS zoom avoids fractional-DPR rounding (2481x3509) while retaining 300dpi vector/text rasterization.
    await page.setViewportSize({ width: 2480, height: 3508 });
    await page.locator('.print-report').evaluate(
      (node, scale) => {
        (node as HTMLElement).style.zoom = String(scale);
      },
      2480 / ((210 * 96) / 25.4),
    );
    const sheets = page.locator('.print-sheet');
    const count = request.format === 'cover' ? 1 : await sheets.count();
    const files: Record<string, Uint8Array> = {};
    for (let i = 0; i < count; i++) {
      // Capture one visible sheet per viewport so long reports cannot exceed Chromium's document screenshot bounds.
      await sheets.evaluateAll((nodes, index) => {
        nodes.forEach((node, position) => {
          (node as HTMLElement).style.display = position === index ? '' : 'none';
        });
        window.scrollTo(0, 0);
      }, i);
      const screenshot = await page.screenshot({
        type: 'png',
        animations: 'disabled',
        scale: 'css',
      });
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
    await browser.close();
  }
}
export { mime as exportMime };
