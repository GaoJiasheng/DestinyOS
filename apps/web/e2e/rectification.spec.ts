import { expect, test } from '@playwright/test';
import zhCopy from '../messages/zh.json';
import enCopy from '../messages/en.json';
import twCopy from '../messages/zh-TW.json';
for (const locale of ['zh', 'en', 'zh-TW'] as const) {
  test(`${locale}: unknown birth time → questionnaire → trial report → revise birth time`, async ({
    page,
  }) => {
    const copy = locale === 'zh-TW' ? twCopy : locale === 'zh' ? zhCopy : enCopy;
    await page.addInitScript(() => localStorage.setItem('tianji-disclaimer-v1', 'accepted'));
    await page.goto(`/${locale}/ziwei/new`);
    await page.getByLabel(copy['form.birth.year'], { exact: true }).fill('1990');
    await page.getByLabel(copy['form.birth.month'], { exact: true }).fill('5');
    await page.getByLabel(copy['form.birth.day'], { exact: true }).fill('15');
    await page.getByLabel(copy['form.birth.timeUnknown']).check();
    await expect(
      page.getByRole('status').filter({ hasText: copy['ziwei.chart.timeRequired'] }),
    ).toBeVisible();
    await page
      .getByRole('button', { name: copy['rectification.entry'], exact: true })
      .first()
      .click();
    await expect(page).toHaveURL(`/${locale}/rectify`);
    await page.getByLabel(copy['rectification.period']).selectOption('morning');
    for (const fieldset of await page.locator('fieldset').all())
      await fieldset.locator('input[value="a"]').check();
    await page.getByRole('button', { name: copy['rectification.rank'] }).click();
    await expect(page.getByTestId('rectification-candidate')).toHaveCount(3);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      page.viewportSize()!.width,
    );
    await page.getByText(copy['rectification.allCandidates']).click();
    await expect(page.locator('details ol li')).toHaveCount(12);
    const similarity = await page
      .getByTestId('rectification-candidate')
      .first()
      .locator('p')
      .nth(1)
      .textContent();
    const percent = similarity!.match(/\d+%/)![0];
    await page
      .getByTestId('rectification-candidate')
      .first()
      .getByRole('button', { name: copy['rectification.try'], exact: true })
      .click();
    await expect(page).toHaveURL(new RegExp(`/${locale}/ziwei/r/local/`), { timeout: 90_000 });
    await expect(page.getByTestId('ziwei-board').locator('.ziwei-palace')).toHaveCount(12);
    await expect(page.getByTestId('rectification-notice')).toContainText(percent);
    await page.reload();
    await expect(page.getByTestId('rectification-notice')).toContainText(percent);
    const other = locale === 'en' ? 'zh' : 'en';
    const otherCopy = other === 'zh' ? zhCopy : enCopy;
    await page.goto(page.url().replace(`/${locale}/`, `/${other}/`));
    await expect(page.getByTestId('rectification-notice')).toContainText(percent);
    await page
      .getByTestId('rectification-notice')
      .getByRole('link', { name: otherCopy['rectification.editBirth'] })
      .click();
    await expect(page).toHaveURL(`/${other}/me/birth`);
    await page.getByLabel(otherCopy['form.birth.precise']).check();
    await page.getByLabel(otherCopy['form.birth.time'], { exact: true }).fill('10:00');
    await page.getByRole('button', { name: otherCopy['form.birth.next'], exact: true }).click();
    await page.getByRole('button', { name: otherCopy['form.birth.save'], exact: true }).click();
    await expect(page).toHaveURL(`/${other}/me`);
    expect(await page.evaluate(() => localStorage.getItem('tianji.anon'))).not.toContain('1990');
  });
}
