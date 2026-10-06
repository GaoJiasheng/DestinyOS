import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

// DESIGN-GAP: Artwork must retain translated alt text after public message catalogs are trimmed; fail on client translation errors as well as missing pixels.
const translationErrors = new WeakMap<Page, string[]>();

test.beforeEach(async ({ page }, info) => {
  const errors: string[] = [];
  translationErrors.set(page, errors);
  page.on('console', (message) => {
    if (/MISSING_MESSAGE|INVALID_MESSAGE/.test(message.text())) errors.push(message.text());
  });
  await page.route('**/pagead/**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/javascript', body: '' }),
  );
  await page.addInitScript((accepted) => {
    if (accepted) localStorage.setItem('tianji-disclaimer-v1', 'accepted');
  }, !info.title.includes('first-visit'));
});
test.afterEach(({ page }) => expect(translationErrors.get(page)).toEqual([]));

test('zh: first-visit artwork including offline precache stays within 400KB', async ({
  page,
  context,
}, info) => {
  const images = new Map<string, number>();
  context.on('response', (response) => {
    if (
      !response.url().includes('/art/') ||
      !response.headers()['content-type']?.startsWith('image/')
    )
      return;
    const bytes = Number(response.headers()['content-length'] ?? 0);
    if (bytes > 0) images.set(response.url(), bytes);
  });
  await page.goto('/zh');
  const illustration = page.locator('[data-art="states/disclaimer"] img');
  await expect(illustration).toBeVisible();
  await expect
    .poll(() =>
      illustration.evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0),
    )
    .toBe(true);
  await page.waitForFunction(() => navigator.serviceWorker.controller);
  expect([...images.keys()].some((url) => url.endsWith('/states/offline-small.webp'))).toBe(true);
  const bytes = [...images.values()].reduce((total, value) => total + value, 0);
  await info.attach('first-visit-art-budget', {
    body: JSON.stringify({ bytes, images: [...images] }, null, 2),
    contentType: 'application/json',
  });
  expect(bytes).toBeGreaterThan(0);
  expect(bytes).toBeLessThanOrEqual(400_000);
});

for (const locale of ['zh', 'en'] as const) {
  test(`${locale}: generated Hero stays within the initial image budget and system art loads on demand`, async ({
    page,
  }) => {
    await page.goto(`/${locale}`);
    const hero = page.locator('[data-art="hero/galaxy"] img');
    await expect
      .poll(() =>
        hero.evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0),
      )
      .toBe(true);
    await expect
      .poll(() =>
        page
          .locator('[data-art="hero/ink-clouds"] img')
          .evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0),
      )
      .toBe(true);
    const transfer = await page.evaluate(() =>
      performance
        .getEntriesByType('resource')
        .filter((entry) => entry.name.includes('/art/'))
        .reduce((sum, entry) => sum + (entry as PerformanceResourceTiming).encodedBodySize, 0),
    );
    expect(transfer).toBeLessThanOrEqual(400_000);
    expect(transfer).toBeGreaterThan(0);
    await expect(hero).toHaveAttribute('fetchpriority', 'high');
    const cards = page.locator('.home-system-card picture');
    await expect(cards).toHaveCount(9);
    for (const card of await cards.all()) {
      await card.scrollIntoViewIfNeeded();
      const image = card.locator('img');
      await expect(image).toHaveAttribute('alt', /.+/);
      await expect
        .poll(() =>
          image.evaluate((node: HTMLImageElement) => node.complete && node.naturalWidth > 0),
        )
        .toBe(true);
      expect(await image.evaluate((node: HTMLImageElement) => node.currentSrc)).toMatch(/\.webp$/);
      await expect(image).toHaveAttribute('src', /\.png$/);
    }
    await page.locator('#systems').scrollIntoViewIfNeeded();
    await expect(page.locator('#systems')).toHaveScreenshot(`art-systems-${locale}.png`, {
      animations: 'disabled',
    });
  });

  test(`${locale}: eight painted spreads replace the geometric thumbnails`, async ({ page }) => {
    await page.goto(`/${locale}/tarot`);
    await expect(page.locator('.tarot-spread-option')).toHaveCount(8);
    await expect(page.locator('.tarot-spread-option svg')).toHaveCount(0);
    for (const option of await page.locator('.tarot-spread-option').all()) {
      await option.scrollIntoViewIfNeeded();
      await expect
        .poll(() =>
          option
            .locator('img')
            .evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0),
        )
        .toBe(true);
    }
    await page.locator('.tarot-spread-options').scrollIntoViewIfNeeded();
    await expect(page.locator('.tarot-spread-options')).toHaveScreenshot(
      `art-spreads-${locale}.png`,
      { animations: 'disabled' },
    );
  });
}
