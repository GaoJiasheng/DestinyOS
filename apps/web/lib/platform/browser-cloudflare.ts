import {
  printSettled,
  sizePoster,
  compressPrintImages,
  limitPosterHeight,
  compressPoster,
} from './print-dom';
import puppeteer from '@cloudflare/puppeteer';
import { cloudflareBindings } from './cloudflare';
import type { ReportPage } from './browser';
/** Render with Cloudflare Browser Rendering; production uses the remote binding, Wrangler provides a local browser proxy. */
export async function openCloudflarePage(
  origin: string,
  path: string,
  token: string,
): Promise<ReportPage> {
  const browser = await puppeteer.launch((await cloudflareBindings()).BROWSER);
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 794, height: 1123, deviceScaleFactor: 1 });
    await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
    await page.setBypassServiceWorker(true);
    await page.setRequestInterception(true);
    page.on('request', (request) => {
      const url = new URL(request.url());
      if (url.origin !== origin && url.protocol !== 'data:') {
        void request.abort();
        return;
      }
      const headers = request.headers();
      if (url.origin === origin && url.pathname === path && request.isNavigationRequest())
        headers['x-report-print-token'] = token;
      void request.continue({ headers });
    });
    return {
      async navigate(url) {
        // DESIGN-GAP: Select final media before measuring columns; switching after pagination can wrap and clip a condensed line.
        await page.emulateMediaType(
          new URL(url).searchParams.get('layout') === 'pdf' ? 'print' : 'screen',
        );
        if (!(await page.goto(url, { waitUntil: 'networkidle0', timeout: 60000 }))?.ok())
          throw new Error('Print route unavailable');
      },
      async validate() {
        await page.waitForFunction(printSettled, { timeout: 60000 });
        const valid = await page.evaluate(async () => {
          await document.fonts.ready;
          const root = document.querySelector('.print-report');
          return (
            root?.getAttribute('data-ready') === 'true' &&
            document.fonts.status === 'loaded' &&
            (root?.getAttribute('data-layout') !== 'pdf' ||
              document.querySelectorAll('.print-sheet').length > 0) &&
            !Array.from(document.querySelectorAll('.print-column')).some(
              (n) => n.scrollHeight > n.clientHeight + 1,
            )
          );
        });
        if (!valid) throw new Error('Print fonts or pagination failed');
      },
      async pdf() {
        await page.evaluate(compressPrintImages);
        await page.emulateMediaType('print');
        return page.pdf({
          format: 'A4',
          printBackground: true,
          preferCSSPageSize: true,
          tagged: true,
        });
      },
      async prepareImage(width) {
        await page.setViewport({ width, height: 1200, deviceScaleFactor: 1 });
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
        return page.screenshot({ type: 'jpeg', quality, fullPage: true });
      },
      close: () => browser.close(),
    };
  } catch (error) {
    await browser.close();
    throw error;
  }
}
