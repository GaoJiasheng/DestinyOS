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

/** Chart a bazi reading on this device and return its address. */
async function chartBazi(page: Page) {
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
  return new URL(page.url()).pathname;
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
  await chartBazi(page);
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

/** Shell keys the worker has stored, each with the assets it kept for that page. */
function storedShells(page: Page) {
  return page.evaluate(async (name) => {
    const cache = await caches.open(name);
    const response = await cache.match('/__offline/manifest.json');
    const manifest = (response ? await response.json() : { shells: {} }) as {
      shells: Record<string, { assets: string[] }>;
    };
    return manifest.shells;
  }, OFFLINE_CACHE);
}

/** Chunk and stylesheet paths this document has loaded. */
function loadedChunks(page: Page) {
  return page.evaluate(() =>
    performance
      .getEntriesByType('resource')
      .map((entry) => new URL(entry.name).pathname)
      .filter((path) => path.startsWith('/_next/static/')),
  );
}

test('zh: a device numerology report never opened since the cache was emptied reopens offline', async ({
  page,
  context,
}) => {
  const chunkErrors: string[] = [];
  page.on('pageerror', (error) => {
    if (/ChunkLoadError|Loading (?:CSS )?chunk/i.test(error.message))
      chunkErrors.push(error.message);
  });
  await page.addInitScript(() => localStorage.setItem('tianji-disclaimer-v1', 'accepted'));
  const baziPath = await chartBazi(page);

  await page.goto('/zh/numerology/new');
  const self = page.getByLabel(zh['form.birth.for.self'], { exact: true });
  if (await self.isVisible()) await self.check();
  for (const [key, value] of [
    ['form.birth.year', '1990'],
    ['form.birth.month', '5'],
    ['form.birth.day', '15'],
  ] as const)
    await page.getByLabel(zh[key], { exact: true }).filter({ visible: true }).fill(value);
  await page.getByLabel(zh['numerology.name'], { exact: true }).fill('John Doe');
  await page.getByRole('button', { name: zh['form.birth.submit'], exact: true }).click();
  await expect(page).toHaveURL(/\/zh\/numerology\/r\/local\/[^/]+$/, { timeout: 90_000 });
  const numerologyPath = new URL(page.url()).pathname;

  // Fresh document loads of both reports: what only the numerology page loads is its chart code.
  await page.goto(numerologyPath);
  await expect(page.locator('.numerology-chart')).toBeVisible();
  const numerologyChunks = await loadedChunks(page);
  await page.goto(baziPath);
  await expect(page.getByRole('heading', { name: '命盘概览', exact: true })).toBeVisible();
  const baziChunks = new Set(await loadedChunks(page));
  const chartOnly = numerologyChunks.filter((path) => !baziChunks.has(path));
  expect(chartOnly.length).toBeGreaterThan(0);

  // The state after an upgrade: nothing stored offline, and this visit opens only the bazi report.
  await page.waitForFunction(() => Boolean(navigator.serviceWorker?.controller), undefined, {
    timeout: 30_000,
  });
  await page.evaluate(async (name) => {
    await caches.delete(name);
    localStorage.removeItem('tianji-offline-warm-failed');
  }, OFFLINE_CACHE);
  await page.reload();
  await expect(page.getByRole('heading', { name: '命盘概览', exact: true })).toBeVisible();

  // Warming waits for the page's own shell and an idle moment (WARM_DELAY_MS in use-offline-shell.ts).
  await expect
    .poll(async () => (await storedShells(page))['/__offline/shell/zh/numerology']?.assets ?? [], {
      timeout: 60_000,
    })
    .toEqual(expect.arrayContaining(chartOnly));
  const cached = await page.evaluate(
    async ({ name, paths }) => {
      const cache = await caches.open(name);
      const hits = await Promise.all(paths.map((path) => cache.match(path)));
      return paths.filter((_, index) => !hits[index]);
    },
    { name: OFFLINE_CACHE, paths: chartOnly },
  );
  expect(cached, 'numerology chunks missing from the offline store').toEqual([]);

  // Offline answers must come from the worker's store, not the HTTP cache.
  const cdp = await context.newCDPSession(page);
  await cdp.send('Network.clearBrowserCache');
  await context.setOffline(true);
  try {
    await page.goto(numerologyPath);
    await expect(page.locator('.report-offline')).toHaveText(zh['report.offlineNotice']);
    await expect(page.locator('.numerology-chart')).toBeVisible();
    await expect(page.locator('.numerology-grid > div')).toHaveCount(9);
    await expect(page.locator('.chunk-loading')).toHaveCount(0);
    expect(chunkErrors).toEqual([]);
  } finally {
    await context.setOffline(false);
  }
});
