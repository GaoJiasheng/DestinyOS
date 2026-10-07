import { test, expect } from '@playwright/test';
test('navigation feedback paints within 100ms while Flight is still in flight', async ({
  page,
}) => {
  await page.addInitScript(() => localStorage.setItem('tianji-disclaimer-v1', 'accepted'));
  await page.route(
    (url) => url.searchParams.has('_rsc'),
    async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 1200));
      await route.continue();
    },
  );
  await page.goto('/zh');
  await expect(page.locator('.site-header')).toBeVisible();
  await expect(page.locator('.navigation-progress')).toHaveAttribute('data-ready', 'true');
  const elapsed = await page.evaluate(async () => {
    const link = document.querySelector<HTMLAnchorElement>('a[href="/zh/learn"]');
    if (!link) throw new Error('Learning link missing');
    const start = performance.now();
    link.click();
    for (let frame = 0; frame < 6; frame++) {
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      const progress = document.querySelector('.navigation-progress');
      if (
        progress?.getAttribute('data-active') === 'true' &&
        getComputedStyle(progress).opacity === '1'
      )
        return performance.now() - start;
    }
    return 1000;
  });
  expect(elapsed).toBeLessThanOrEqual(100);
  await expect(page).toHaveURL(/\/zh\/learn$/, { timeout: 30000 });
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.locator('.navigation-progress')).toHaveAttribute('data-active', 'false');
});
test('reduced motion keeps static loading feedback and immediate press highlighting', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(() => localStorage.setItem('tianji-disclaimer-v1', 'accepted'));
  await page.goto('/zh/tarot');
  await expect(page.locator('.site-header')).toBeVisible();
  await expect(page.locator('.navigation-progress')).toHaveAttribute('data-ready', 'true');
  await page.evaluate(() => window.dispatchEvent(new Event('tianji-navigation-start')));
  await expect(page.locator('.navigation-progress')).toHaveAttribute('data-active', 'true');
  expect(
    await page
      .locator('.navigation-progress')
      .evaluate((element) => getComputedStyle(element).animationName),
  ).toBe('none');
  const link = page.locator('.site-header .brand-mark');
  await link.hover();
  await page.mouse.down();
  expect(await link.evaluate((element) => getComputedStyle(element).scale)).toBe('1');
  const durations = await link.evaluate((element) => getComputedStyle(element).transitionDuration);
  expect(Math.max(...durations.split(',').map((value) => parseFloat(value)))).toBeLessThanOrEqual(
    0.05,
  );
  expect(await link.evaluate((element) => getComputedStyle(element).filter)).toContain(
    'brightness(1.15)',
  );
  await page.mouse.up();
});
