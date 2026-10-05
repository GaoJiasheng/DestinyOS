import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { Temporal } from '@js-temporal/polyfill';
import { personalNumbers } from '@tianji/engine/numerology';
import zh from '../messages/zh.json';
import en from '../messages/en.json';
for (const locale of ['zh', 'en'] as const) {
  test(`${locale}: numerology input, report, profile reuse, daily and encyclopedia`, async ({
    page,
  }) => {
    const copy = locale === 'zh' ? zh : en;
    await page.addInitScript(() => {
      localStorage.setItem('tianji-disclaimer-v1', 'accepted');
      localStorage.setItem('tianji-tz', 'Asia/Singapore');
    });
    await page.goto(`/${locale}`);
    await expect(page.locator('[data-home-system="numerology"]')).toBeVisible();
    await page.locator('[data-home-system="numerology"]').click();
    await page.getByRole('link', { name: copy['form.birth.submit'], exact: true }).click();
    await page.getByLabel(copy['form.birth.year'], { exact: true }).fill('1990');
    await page.getByLabel(copy['form.birth.month'], { exact: true }).fill('5');
    await page.getByLabel(copy['form.birth.day'], { exact: true }).fill('15');
    await page.getByLabel(copy['numerology.name'], { exact: true }).fill('John Doe');
    await page.getByRole('button', { name: copy['form.birth.submit'], exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`/${locale}/numerology/r/local/`));
    await expect(page.locator('.numerology-metric').first().locator('strong')).toHaveText('3');
    await expect(page.locator('.numerology-metric').nth(2).locator('strong')).toHaveText('8');
    await expect(page.locator('.numerology-grid > div')).toHaveCount(9);
    await expect(page.locator('.numerology-cycle')).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'west');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.locator('.numerology-metric').first().press('Enter');
    await expect(page.locator('#section-life_path')).toBeFocused();
    const accessibility = await new AxeBuilder({ page }).include('.numerology-chart').analyze();
    expect(accessibility.violations).toEqual([]);
    await page.screenshot({
      path: test.info().outputPath(`numerology-${locale}.png`),
      fullPage: true,
    });
    await page.goto(`/${locale}/numerology/new`);
    await expect(page.getByLabel(copy['form.birth.year'], { exact: true })).toHaveValue('1990');
    await expect(page.getByLabel(copy['form.birth.month'], { exact: true })).toHaveValue('5');
    await expect(page.getByLabel(copy['form.birth.day'], { exact: true })).toHaveValue('15');
    await page.getByRole('button', { name: copy['form.birth.submit'], exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`/${locale}/numerology/r/local/`));
    await expect(page.getByText(copy['numerology.noName'], { exact: true })).toBeVisible();
    await page.goto(`/${locale}/today`);
    const date = Temporal.Now.instant()
      .toZonedDateTimeISO('Asia/Singapore')
      .toPlainDate()
      .toString();
    const expected = personalNumbers(5, 15, date).day;
    await expect(page.locator('[data-personal-day]')).toContainText(String(expected));
    await page.goto(`/${locale}/learn/numerology`);
    await expect(
      page.getByRole('heading', { name: copy['nav.numerology'], exact: true }),
    ).toBeVisible();
  });
}
