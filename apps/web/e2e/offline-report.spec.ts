import { test, expect, type Page } from '@playwright/test';
import zh from '../messages/zh.json' with { type: 'json' };

const OFFLINE_CACHE = 'tianji-offline-reports-v1';

/** Whether the service worker has stored the anonymous bazi page and the history list, each with its chunks. */
function shellsStored(page: Page) {
  return page.evaluate(async (name) => {
    const cache = await caches.open(name);
    const response = await cache.match('/__offline/manifest.json');
    const manifest = (response ? await response.json() : { shells: {} }) as {
      shells: Record<string, { assets: string[] } | undefined>;
    };
    return ['/__offline/shell/zh/bazi', '/__offline/shell/zh/history'].every(
      (key) => (manifest.shells[key]?.assets.length ?? 0) > 0,
    );
  }, OFFLINE_CACHE);
}

test('zh: a device bazi report reopens offline after a reload and from the history list', async ({
  page,
  context,
}) => {
  const chunkErrors: string[] = [];
  page.on('pageerror', (error) => {
    if (/ChunkLoadError|Loading (?:CSS )?chunk/i.test(error.message))
      chunkErrors.push(error.message);
  });
  await page.addInitScript(() => localStorage.setItem('tianji-disclaimer-v1', 'accepted'));
  await page.goto('/zh/bazi/new');
  await page.getByLabel('年', { exact: true }).fill('1990');
  await page.getByLabel('月', { exact: true }).fill('5');
  await page.getByLabel('日', { exact: true }).fill('15');
  await page.getByLabel('精确到分钟').check();
  await page.getByLabel('出生时间', { exact: true }).fill('08:30');
  await page.getByRole('button', { name: '下一步', exact: true }).click();
  await page.getByLabel('出生城市', { exact: true }).fill('北京');
  await page.getByRole('option').filter({ hasText: 'Asia/Shanghai' }).first().click();
  await page.getByLabel('性别', { exact: true }).selectOption('male');
  await page.getByRole('button', { name: '排盘', exact: true }).click();
  await expect(page).toHaveURL(/\/zh\/bazi\/r\/local\/[^/]+$/, { timeout: 90_000 });
  const overview = page.getByRole('heading', { name: '命盘概览', exact: true });
  await expect(overview).toBeVisible();
  const reportPath = new URL(page.url()).pathname;

  // The worker registers a few seconds after the first page load, then stores the shells in the background.
  await page.waitForFunction(() => Boolean(navigator.serviceWorker?.controller), undefined, {
    timeout: 30_000,
  });
  await expect.poll(() => shellsStored(page), { timeout: 45_000 }).toBe(true);
  // Lazy chunks reported after the first batch (BATCH_MS in use-offline-shell.ts) are stored too.
  await page.waitForTimeout(3_000);

  await context.setOffline(true);
  try {
    // 1. A full reload of the report address.
    await page.reload();
    await expect(overview).toBeVisible();
    await expect(page.locator('.report-offline')).toHaveText(zh['report.offlineNotice']);
    await expect(page.locator('.report-chart')).toBeVisible();

    // 2. The history list opens offline and leads back to the same report.
    await page.goto('/zh/me/history');
    const card = page.locator(`.history-list a[href$="${reportPath}"]`);
    await expect(card).toBeVisible();
    await card.click();
    await expect(page).toHaveURL(new RegExp(`${reportPath}$`));
    await expect(overview).toBeVisible();

    // 3. Folded sections still open and show their text.
    const fold = page.locator('details.section-fold').first();
    await fold.locator('summary').click();
    await expect(fold).toHaveJSProperty('open', true);
    await expect(fold.locator('.report-paragraph').first()).toBeVisible();
    expect(chunkErrors).toEqual([]);
  } finally {
    await context.setOffline(false);
  }
});
