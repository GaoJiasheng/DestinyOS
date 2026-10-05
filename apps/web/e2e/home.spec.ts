import { test, expect } from '@playwright/test';
import { perfSnapshot } from '../../../scripts/perf-fixture';
import { encryptAnonymous } from '../lib/anonymous-storage';
import { computeAstrology } from '@tianji/engine/astrology';
import { normalizeBirth } from '@tianji/engine';
import { baziReading } from '../test/fixtures/bazi-reading';
import zh from '../messages/zh.json';
import en from '../messages/en.json';
import { System } from '@tianji/shared';
const homeSystems = Object.values(System).filter((system) => system !== 'daily');
test('WebGL2 unavailable retains CSS stars without reduced motion', async ({ page, context }) => {
  await context.setGeolocation({ latitude: 1.3521, longitude: 103.8198 });
  await context.grantPermissions(['geolocation']);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.addInitScript(() => {
    localStorage.setItem('tianji-disclaimer-v1', 'accepted');
    Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', { value: () => null });
  });
  await page.goto('/zh');
  await page.waitForTimeout(4500);
  await expect(page.locator('[data-starfield-canvas]')).toHaveCount(0);
  await expect(page.locator('.stars-small')).toBeVisible();
  await expect(page.locator('.sky-caption')).toHaveText(zh['home.sky.origin']);
});
for (const locale of ['zh', 'en'] as const) {
  test(`${locale}: CSS fallback, picker, install, offline public shell`, async ({
    page,
    context,
  }) => {
    const copy = locale === 'zh' ? zh : en;
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.addInitScript(() => localStorage.setItem('tianji-disclaimer-v1', 'accepted'));
    await page.goto(`/${locale}`);
    await expect(page.getByRole('heading', { name: copy['home.glimpse.sky'] })).toBeVisible();
    await expect(page.locator('.sky-facts')).not.toContainText('daily.');
    await expect(page.locator('[data-home-system]')).toHaveCount(homeSystems.length);
    expect(
      await page
        .locator('[data-home-system]')
        .evaluateAll((cards) => cards.map((card) => card.getAttribute('data-home-system')).sort()),
    ).toEqual([...homeSystems].sort());
    await expect(page.locator('[data-starfield-canvas]')).toHaveCount(0);
    await expect(page.locator('.stars-small')).toBeVisible();
    await page.getByRole('button', { name: copy['home.cta.start'], exact: true }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.keyboard.press('Escape');
    await page.evaluate(() => {
      const install = new Event('beforeinstallprompt', { cancelable: true });
      Object.assign(install, {
        prompt: async () => {},
        userChoice: Promise.resolve({ outcome: 'accepted' }),
      });
      window.dispatchEvent(install);
    });
    await page.getByRole('button', { name: copy['pwa.install.action'], exact: true }).click();
    await expect(page.locator('.install-prompt')).toHaveCount(0);
    await page.evaluate(() => document.fonts.ready);
    // DESIGN-GAP: The idle glyph loader can finish after document.fonts.ready; stabilize its actual selection before comparing merged homepage cards.
    await page.waitForFunction(() => document.documentElement.dataset.fontsSettled === 'true');
    await page.mouse.move(0, 0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    // DESIGN-GAP: Collect independent homepage visual differences while preserving failure status and subsequent interaction coverage.
    await expect.soft(page.locator('.home-hero')).toHaveScreenshot(`hero-${locale}.png`);
    await expect.soft(page.locator('.home-systems')).toHaveScreenshot(`systems-${locale}.png`);
    await page.waitForFunction(() => navigator.serviceWorker.controller);
    expect(
      await page.evaluate(async () => {
        const keys = await caches.keys();
        const urls = (
          await Promise.all(
            keys.map(async (key) => (await (await caches.open(key)).keys()).map((r) => r.url)),
          )
        ).flat();
        return urls.every(
          (url) => !url.includes('/api/') && !url.includes('/r/') && !url.includes('/me/'),
        );
      }),
    ).toBe(true);
    await context.setOffline(true);
    await page.goto(`/${locale}`);
    await expect(page.getByRole('heading', { name: copy['pwa.offline.title'] })).toBeVisible();
    await expect(page.locator('.cards a')).toHaveCount(homeSystems.length);
    for (const system of homeSystems)
      await expect(page.locator(`.cards a[href="/${locale}/${system}"]`)).toBeVisible();
  });
}
test('personal preview and report; lazy sky and natal 3D render without errors', async ({
  page,
  context,
}, info) => {
  await page.addInitScript(
    (snapshot) => {
      localStorage.setItem('tianji-disclaimer-v1', 'accepted');
      if (!localStorage.getItem('tianji.anon')) localStorage.setItem('tianji.anon', snapshot);
    },
    await perfSnapshot(),
  );
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const fonts = new Map<string, number>();
  page.on('response', (r) => {
    if (r.url().endsWith('.woff2'))
      fonts.set(
        r.url(),
        Math.max(fonts.get(r.url()) ?? 0, Number(r.headers()['content-length'] ?? 0)),
      );
  });
  await page.goto('/zh');
  await expect(page.getByRole('heading', { name: zh['home.glimpse.title'] })).toBeVisible();
  await expect(page.locator('.lucky-color')).toBeVisible();
  await page.waitForFunction(() => document.documentElement.dataset.fontBudget);
  await page.evaluate(() => document.fonts.ready);
  expect([...fonts.values()].reduce((sum, n) => sum + n, 0)).toBeLessThanOrEqual(
    350 * 1024 + 60 * 1024,
  );
  if (info.project.name === 'desktop') {
    await expect(page.locator('[data-starfield-canvas] canvas')).toBeVisible();
    expect(
      await page
        .locator('canvas')
        .evaluate((canvas: HTMLCanvasElement) => canvas.width / canvas.clientWidth),
    ).toBeLessThanOrEqual(1.5);
  }
  fonts.clear();
  await page.goto('/zh/bazi/r/local/33333333-3333-4333-8333-333333333333');
  await expect(page.locator('#chart-root')).toBeVisible();
  await page.waitForFunction(() => document.documentElement.dataset.fontBudget);
  await page.evaluate(() => document.fonts.ready);
  const chineseBytes = [...fonts]
    .filter(([url]) => url.includes('/fonts/'))
    .reduce((sum, [, n]) => sum + n, 0);
  console.log('Report Chinese font bytes:', chineseBytes);
  expect(chineseBytes).toBeLessThanOrEqual(350 * 1024);
  for (const [family, limit] of [
    ['wenkai', 180],
    ['noto', 300],
  ] as const)
    expect(
      [...fonts]
        .filter(([url]) => url.includes(`/fonts/${family}-`))
        .reduce((sum, [, n]) => sum + n, 0),
    ).toBeLessThanOrEqual(limit * 1024);
  const base = baziReading('zh'),
    birth = base.request.birth!;
  const chart = computeAstrology(normalizeBirth(birth));
  const local = {
    ...base,
    system: 'astrology' as const,
    chart,
    request: { ...base.request, system: 'astrology' as const },
    report: { ...base.report, system: 'astrology' as const },
  };
  const snapshot = await encryptAnonymous({
    anonId: '22222222-2222-4222-8222-222222222222',
    profile: birth,
    settings: {},
    readings: [local],
  });
  await page.evaluate((snapshot) => localStorage.setItem('tianji.anon', snapshot), snapshot);
  await page.goto(`/zh/astrology/r/local/${local.id}`);
  await page.getByRole('button', { name: zh['charts.natal.three'], exact: true }).click();
  await expect(page.locator('[data-natal-wheel-3d] canvas')).toBeVisible();
  await expect(page.locator('.sky-body')).toHaveCount(chart.bodies.length);
  await expect(page.locator('.sky-body').first()).toBeVisible();
  await page.waitForTimeout(500);
  await page.locator('.sky-body').first().click();
  await expect(page.locator('.sky-body').first()).toHaveAttribute('aria-pressed', 'true');
  await page.locator('[data-natal-wheel-3d]').screenshot({ path: info.outputPath('natal-3d.png') });
  await page.getByRole('button', { name: zh['charts.natal.three'], exact: true }).click();
  await expect(page.locator('[data-natal-wheel-3d]')).toHaveCount(0);
  expect(errors).toEqual([]);
  await context.setOffline(false);
});
