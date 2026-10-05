import { test, expect } from '@playwright/test';
import { audit, auditLocale, login, db, seedReading, copies } from './m5-helpers';
const publicPaths = [
  '',
  '/about',
  '/contact',
  '/privacy',
  '/terms',
  '/disclaimer',
  '/credits',
  '/pricing',
  '/auth/login',
  '/auth/verify',
  '/age-restricted',
  '/today',
  '/learn',
  '/learn/glossary/day_master',
  '/learn/tarot/major_00_fool',
  '/learn/iching/hexagram_01',
  '/me',
  '/me/birth',
  '/me/history',
  '/me/settings',
  '/me/billing',
  '/iching',
  '/iching/cast',
  '/qimen',
  '/tarot',
  '/tarot/reading',
  ...['bazi', 'ziwei', 'astrology', 'vedic'].flatMap((system) => [`/${system}`, `/${system}/new`]),
  ...['bazi', 'ziwei', 'iching', 'qimen', 'tarot', 'astrology', 'vedic'].map(
    (system) => `/learn/${system}`,
  ),
];
for (const locale of ['zh', 'en'] as const) {
  test.describe(`${locale}: every public route template with axe`, () => {
    for (const path of publicPaths)
      test(path || 'home', async ({ page }, info) => {
        await page.addInitScript(() => localStorage.setItem('tianji-disclaimer-v1', 'accepted'));
        const response = await page.goto(`/${locale}${path}`);
        expect(response?.status()).toBe(200);
        const result = await audit(page);
        await auditLocale(page, locale);
        await info.attach('axe-document', {
          body: JSON.stringify(result),
          contentType: 'application/json',
        });
        if (!path)
          await expect(page.locator('.home-hero')).toHaveScreenshot(`m5-home-${locale}.png`);
        await page.keyboard.press('Tab');
        await expect(page.locator('a.skip-link')).toBeFocused();
        await page.keyboard.press('Enter');
        await expect(page.locator('main')).toBeFocused();
      });
  });
  test(`${locale}: seven report charts, technical views, keyboard, visual baselines and axe`, async ({
    page,
    request,
  }, info) => {
    await page.addInitScript(() => localStorage.setItem('tianji-disclaimer-v1', 'accepted'));
    const user = await login(page, request, locale);
    for (const system of [
      'bazi',
      'ziwei',
      'iching',
      'qimen',
      'tarot',
      'astrology',
      'vedic',
    ] as const) {
      const row = await seedReading(user.id, system, locale);
      await page.goto(`/${locale}/${system}/r/${row.id}`);
      await expect(page.locator('#chart-root')).toBeVisible();
      const result = await audit(page, true);
      await auditLocale(page, locale);
      await info.attach(`axe-${system}`, {
        body: JSON.stringify(result),
        contentType: 'application/json',
      });
      await expect(page.locator('#chart-root')).toHaveScreenshot(`m5-${system}-${locale}.png`);
      const copy = copies[locale];
      await page.getByRole('button', { name: copy['report.proView'], exact: true }).click();
      await audit(page, true);
      await auditLocale(page, locale);
    }
    await db.$disconnect();
  });
}
