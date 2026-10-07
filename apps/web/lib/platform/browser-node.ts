import {
  printSettled,
  sizePoster,
  compressPrintImages,
  limitPosterHeight,
  compressPoster,
} from './print-dom';
import { chromium } from 'playwright-core';
import type { ReportPage } from './browser';
/** Run Playwright locally or with Vercel's serverless Chromium. */
export async function openNodePage(
  origin: string,
  path: string,
  token: string,
): Promise<ReportPage> {
  const executable = process.env.VERCEL ? (await import('@sparticuz/chromium')).default : null;
  const browser = await chromium.launch(
    executable
      ? {
          args: executable.args,
          executablePath: await executable.executablePath(),
          headless: true,
        }
      : { headless: true },
  );
  try {
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
      if (url.origin === origin && url.pathname === path) headers['x-report-print-token'] = token;
      if (process.env.VERCEL_AUTOMATION_BYPASS_SECRET)
        headers['x-vercel-protection-bypass'] = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
      return route.continue({ headers });
    });
    const page = await context.newPage();
    return {
      async navigate(url) {
        // DESIGN-GAP: Select final media before measuring columns; switching after pagination can wrap and clip a condensed line.
        await page.emulateMedia({
          media: new URL(url).searchParams.get('layout') === 'pdf' ? 'print' : 'screen',
        });
        if (!(await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 }))?.ok())
          throw new Error('Print route unavailable');
      },
      async validate() {
        await page.waitForFunction(printSettled, {}, { timeout: 60000 });
        if ((await page.locator('.print-report').getAttribute('data-ready')) !== 'true')
          throw new Error('Print pagination failed');
        if (
          await page
            .locator('.print-column')
            .evaluateAll((nodes) => nodes.some((n) => n.scrollHeight > n.clientHeight + 1))
        )
          throw new Error('Print content overflow');
      },
      async pdf() {
        await page.evaluate(compressPrintImages);
        await page.emulateMedia({ media: 'print' });
        return page.pdf({
          format: 'A4',
          printBackground: true,
          preferCSSPageSize: true,
          tagged: true,
        });
      },
      async prepareImage(width) {
        await page.setViewportSize({ width, height: 1200 });
        return page.evaluate(sizePoster, width);
      },
      async limitImageHeight(height) {
        await page.evaluate(limitPosterHeight, height);
      },
      async compressImage(data) {
        const encoded = await page.evaluate(
          compressPoster,
          `data:image/jpeg;base64,${Buffer.from(data).toString('base64')}`,
        );
        return Buffer.from(encoded.slice(encoded.indexOf(',') + 1), 'base64');
      },
      async screenshotImage(quality) {
        return page.screenshot({
          type: 'jpeg',
          quality,
          fullPage: true,
          animations: 'disabled',
          scale: 'css',
        });
      },
      close: () => browser.close(),
    };
  } catch (error) {
    await browser.close();
    throw error;
  }
}
