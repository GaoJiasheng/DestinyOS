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
        if (!(await page.goto(url, { waitUntil: 'networkidle0', timeout: 60000 }))?.ok())
          throw new Error('Print route unavailable');
      },
      async validate() {
        await page.waitForFunction(
          () =>
            ['true', 'error'].includes(
              document.querySelector('.print-report')?.getAttribute('data-ready') ?? '',
            ),
          { timeout: 60000 },
        );
        const valid = await page.evaluate(async () => {
          await document.fonts.ready;
          const root = document.querySelector('.print-report');
          return (
            root?.getAttribute('data-ready') === 'true' &&
            document.fonts.status === 'loaded' &&
            document.querySelectorAll('.print-sheet').length > 0 &&
            !Array.from(document.querySelectorAll('.print-page-content')).some(
              (n) => n.scrollHeight > n.clientHeight + 1,
            )
          );
        });
        if (!valid) throw new Error('Print fonts or pagination failed');
      },
      async pdf() {
        await page.emulateMediaType('print');
        return page.pdf({
          format: 'A4',
          printBackground: true,
          preferCSSPageSize: true,
          tagged: true,
        });
      },
      async preparePng() {
        await page.setViewport({ width: 2480, height: 3508, deviceScaleFactor: 1 });
        await page.$eval('.print-report', (node) => {
          (node as HTMLElement).style.zoom = String(2480 / ((210 * 96) / 25.4));
        });
      },
      pageCount: () => page.$$eval('.print-sheet', (nodes) => nodes.length),
      async screenshot(index) {
        await page.$$eval(
          '.print-sheet',
          (nodes, selected) => {
            nodes.forEach((node, i) => {
              (node as HTMLElement).style.display = i === selected ? '' : 'none';
            });
            window.scrollTo(0, 0);
          },
          index,
        );
        return page.screenshot({ type: 'png' });
      },
      close: () => browser.close(),
    };
  } catch (error) {
    await browser.close();
    throw error;
  }
}
