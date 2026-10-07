import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
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
        // DESIGN-GAP: A streamed private page returns its shell before its authentication redirect; audit the completed login document.
        if (path === '/me/billing')
          await page.waitForURL((url) => url.pathname === `/${locale}/auth/login`);
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
      // DESIGN-GAP: Next.js streamed reports briefly include a hidden completed segment; wait for its hydration replacement without accepting permanent duplicate IDs.
      await expect(page.locator('#main #chart-root')).toBeVisible();
      await expect(page.locator('html')).toHaveAttribute('data-fonts-settled', 'true');
      await expect(page.locator('#chart-root')).toHaveCount(1);
      await expect(page.locator('#chart-root')).toBeVisible();
      const result = await audit(page, true);
      await auditLocale(page, locale);
      await info.attach(`axe-${system}`, {
        body: JSON.stringify(result),
        contentType: 'application/json',
      });
      // DESIGN-GAP: Collect every system's independent visual mismatch in one run; soft assertions still fail the test and preserve all subsequent accessibility evidence.
      await expect
        .soft(page.locator('#chart-root'))
        .toHaveScreenshot(`m5-${system}-${locale}.png`, {
          // DESIGN-GAP: Reuse Vedic's date-neutral component stylesheet so the current dasha pointer and calculation date cannot make daily acceptance snapshots stale.
          ...(system === 'vedic' ? { stylePath: 'apps/web/e2e/astrology-screenshot.css' } : {}),
        });
      const copy = copies[locale];
      await page.getByRole('button', { name: copy['report.proView'], exact: true }).click();
      await audit(page, true);
      await auditLocale(page, locale);
    }
    await db.$disconnect();
  });
}

for (const locale of ['zh', 'en'] as const)
  test(`${locale}: fixed mobile navigation retains contrast over bright content`, async ({
    page,
  }) => {
    await page.addInitScript(() => localStorage.setItem('tianji-disclaimer-v1', 'accepted'));
    await page.goto(`/${locale}/pricing`);
    await expect(page.locator('.mobile-tabs')).toBeVisible();
    await page.evaluate(() => {
      const content = document.createElement('div');
      content.setAttribute('aria-hidden', 'true');
      Object.assign(content.style, {
        position: 'fixed',
        bottom: '0',
        left: '0',
        right: '0',
        height: '100px',
        background: '#d4af6a',
        zIndex: '29',
        pointerEvents: 'none',
      });
      document.body.append(content);
    });
    const result = await new AxeBuilder({ page }).include('.mobile-tabs').analyze();
    expect(
      result.violations.filter(
        (violation) => violation.impact === 'serious' || violation.impact === 'critical',
      ),
    ).toEqual([]);
  });
