import { test, expect } from '@playwright/test';
import zh from '../messages/zh.json';
import en from '../messages/en.json';
for (const locale of ['zh', 'en'] as const) {
  const copy = locale === 'zh' ? zh : en;
  test(`${locale}: Workers homepage → anonymous bazi report → daily fortune`, async ({
    page,
    request,
  }) => {
    await page.addInitScript(() => localStorage.setItem('tianji-disclaimer-v1', 'accepted'));
    await page.goto(`/${locale}`);
    await expect(page.locator('h1')).toBeVisible();
    const providers = await request.get('/api/auth/providers');
    expect(providers.status()).toBe(200);
    expect(await providers.json()).toHaveProperty('google');
    await page.goto(`/${locale}/bazi/new`);
    await page.getByLabel(copy['form.birth.year'], { exact: true }).fill('1990');
    await page.getByLabel(copy['form.birth.month'], { exact: true }).fill('5');
    await page.getByLabel(copy['form.birth.day'], { exact: true }).fill('15');
    await page.getByLabel(copy['form.birth.precise'], { exact: true }).check();
    await page.getByLabel(copy['form.birth.time'], { exact: true }).fill('08:30');
    await page.getByRole('button', { name: copy['form.birth.next'], exact: true }).click();
    await page.getByLabel(copy['form.birth.city'], { exact: true }).fill('Beijing');
    await page.getByRole('option').filter({ hasText: 'Asia/Shanghai' }).first().click();
    await page.getByLabel(copy['form.birth.gender'], { exact: true }).selectOption('male');
    await page
      .getByRole('button', { name: locale === 'zh' ? '排盘' : 'Create reading', exact: true })
      .click();
    await expect(page).toHaveURL(new RegExp(`/${locale}/bazi/r/local/`), { timeout: 90000 });
    await expect(
      page.getByRole('heading', {
        name: locale === 'zh' ? '命盘概览' : 'Your Chart at a Glance',
        exact: true,
      }),
    ).toBeVisible();
    await page.goto(`/${locale}/today`);
    await expect(page.locator('[data-daily-block]')).toHaveCount(13);
    const today = await page.locator('header time').getAttribute('datetime');
    await page.getByRole('button', { name: copy['daily.tomorrow'], exact: true }).click();
    await expect(page.locator('header time')).not.toHaveAttribute('datetime', today!);
    await expect(page.locator('[data-daily-block="10"] li')).toHaveCount(6);
    await page.screenshot({ path: `test-results/cloudflare-${locale}-today.png` });
    expect(
      (
        await request.post('/api/v1/stripe/webhook', {
          headers: { 'stripe-signature': 'invalid' },
          data: '{ "test": true }',
        })
      ).status(),
    ).toBe(400);
    expect((await request.get('/api/v1/cron/daily-maintenance')).status()).toBe(401);
  });
}
