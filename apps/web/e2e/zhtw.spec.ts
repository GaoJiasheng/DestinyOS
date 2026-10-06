import { test, expect } from '@playwright/test';
import zh from '../messages/zh.json' with { type: 'json' };
import tw from '../messages/zh-TW.json' with { type: 'json' };
import { simplifiedResidue } from '../../../packages/shared/test/traditional-check';

test('zh-TW: route, three-language switch, SEO, glossary and report contain no simplified residue', async ({
  page,
}) => {
  test.setTimeout(180_000);
  await page.addInitScript(() => localStorage.setItem('tianji-disclaimer-v1', 'accepted'));
  await page.goto('/zh?test=locale#systems');
  const select = page.getByRole('combobox', { name: zh['nav.language'] }).first();
  await expect(select.locator('option')).toHaveCount(3);
  await select.selectOption('zh-TW');
  await expect(page).toHaveURL(/\/zh-TW\?test=locale#systems$/);
  await expect(page.locator('html')).toHaveAttribute('lang', 'zh-TW');
  await expect(page.locator('h1')).toContainText('天機');
  await expect(page.locator('link[rel="alternate"][hreflang="zh-TW"]')).toHaveAttribute(
    'href',
    /\/zh-TW$/,
  );
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', /\/zh-TW$/);
  expect(simplifiedResidue(await page.locator('main').innerText())).toEqual([]);
  expect((await page.context().cookies()).find((c) => c.name === 'NEXT_LOCALE')?.value).toBe(
    'zh-TW',
  );
  await page.goto('/zh-TW/learn/glossary/graha.rahu');
  await expect(page.locator('main h1')).toContainText('羅睺');
  expect(simplifiedResidue(await page.locator('main').innerText())).toEqual([]);
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    'href',
    /\/zh-TW\/learn\/glossary\/graha.rahu$/,
  );
  await page.goto('/zh-TW/numerology/new');
  await page.getByLabel(tw['form.birth.year'], { exact: true }).fill('1990');
  await page.getByLabel(tw['form.birth.month'], { exact: true }).fill('5');
  await page.getByLabel(tw['form.birth.day'], { exact: true }).fill('15');
  await page.getByRole('button', { name: tw['form.birth.submit'], exact: true }).click();
  await expect(page).toHaveURL(/\/zh-TW\/numerology\/r\/local\//, { timeout: 60_000 });
  await expect(page.locator('.report-body')).toBeVisible({ timeout: 30_000 });
  const prose = await page.locator('.report-body').innerText();
  expect(prose.length).toBeGreaterThan(2500);
  expect(simplifiedResidue(prose)).toEqual([]);
  await page.getByRole('combobox', { name: tw['nav.language'] }).first().selectOption('zh');
  await expect(page.locator('html')).toHaveAttribute('lang', 'zh');
  await expect(page.locator('.report-body')).toBeVisible();
  expect(simplifiedResidue(await page.locator('.report-body').innerText()).length).toBeGreaterThan(
    0,
  );
  await page.getByRole('combobox', { name: zh['nav.language'] }).first().selectOption('zh-TW');
  await expect(page.locator('html')).toHaveAttribute('lang', 'zh-TW');
  await expect(page.locator('.report-body')).toBeVisible();
  expect(simplifiedResidue(await page.locator('.report-body').innerText())).toEqual([]);
});
