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
        if (!(await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 }))?.ok())
          throw new Error('Print route unavailable');
      },
      async validate() {
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
        if (
          await page
            .locator('.print-page-content')
            .evaluateAll((nodes) => nodes.some((n) => n.scrollHeight > n.clientHeight + 1))
        )
          throw new Error('Print content overflow');
      },
      async pdf() {
        await page.emulateMedia({ media: 'print' });
        return page.pdf({
          format: 'A4',
          printBackground: true,
          preferCSSPageSize: true,
          tagged: true,
        });
      },
      async preparePng() {
        await page.setViewportSize({ width: 2480, height: 3508 });
        await page.locator('.print-report').evaluate((node) => {
          (node as HTMLElement).style.zoom = String(2480 / ((210 * 96) / 25.4));
        });
      },
      pageCount: () => page.locator('.print-sheet').count(),
      async screenshot(index) {
        await page.locator('.print-sheet').evaluateAll((nodes, selected) => {
          nodes.forEach((node, i) => {
            (node as HTMLElement).style.display = i === selected ? '' : 'none';
          });
          window.scrollTo(0, 0);
        }, index);
        return page.screenshot({ type: 'png', animations: 'disabled', scale: 'css' });
      },
      close: () => browser.close(),
    };
  } catch (error) {
    await browser.close();
    throw error;
  }
}
