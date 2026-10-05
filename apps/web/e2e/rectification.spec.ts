import { expect, test } from '@playwright/test';
for (const locale of ['zh', 'en'] as const) {
  test(`${locale}: unknown birth time → questionnaire → trial report → revise birth time`, async ({
    page,
  }) => {
    const zh = locale === 'zh';
    await page.addInitScript(() => localStorage.setItem('tianji-disclaimer-v1', 'accepted'));
    await page.goto(`/${locale}/ziwei/new`);
    await page.getByLabel(zh ? '年' : 'Year', { exact: true }).fill('1990');
    await page.getByLabel(zh ? '月' : 'Month', { exact: true }).fill('5');
    await page.getByLabel(zh ? '日' : 'Day', { exact: true }).fill('15');
    await page.getByLabel(zh ? '我不知道出生时间' : "I don't know my birth time").check();
    await expect(
      page.getByRole('status').filter({ hasText: zh ? '紫微斗数需要' : 'Zi Wei needs' }),
    ).toBeVisible();
    await page
      .getByRole('button', { name: zh ? '辅助定盘' : 'Explore birth-time candidates', exact: true })
      .first()
      .click();
    await expect(page).toHaveURL(`/${locale}/rectify`);
    await page
      .getByLabel(zh ? '大致出生时段' : 'Approximate time of birth')
      .selectOption('morning');
    for (const fieldset of await page.locator('fieldset').all())
      await fieldset.locator('input[value="a"]').check();
    await page
      .getByRole('button', { name: zh ? '比较十二个时辰' : 'Compare twelve birth hours' })
      .click();
    await expect(page.getByTestId('rectification-candidate')).toHaveCount(3);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      page.viewportSize()!.width,
    );
    await page
      .getByText(zh ? '查看全部十二个候选的排序' : 'View all twelve candidates in order')
      .click();
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
      .getByRole('button', { name: zh ? '以此时辰试排' : 'Try this birth hour', exact: true })
      .click();
    await expect(page).toHaveURL(new RegExp(`/${locale}/ziwei/r/local/`), { timeout: 90_000 });
    await expect(page.getByTestId('ziwei-board').locator('.ziwei-palace')).toHaveCount(12);
    await expect(page.getByTestId('rectification-notice')).toContainText(percent);
    await page.reload();
    await expect(page.getByTestId('rectification-notice')).toContainText(percent);
    const other = zh ? 'en' : 'zh';
    await page.goto(page.url().replace(`/${locale}/`, `/${other}/`));
    await expect(page.getByTestId('rectification-notice')).toContainText(percent);
    await page
      .getByTestId('rectification-notice')
      .getByRole('link', { name: zh ? 'Edit birth details' : '修改出生信息' })
      .click();
    await expect(page).toHaveURL(`/${other}/me/birth`);
    await page.getByLabel(zh ? 'Exact time to the minute' : '精确到分钟').check();
    await page.getByLabel(zh ? 'Birth time' : '出生时间', { exact: true }).fill('10:00');
    await page.getByRole('button', { name: zh ? 'Next' : '下一步', exact: true }).click();
    await page.getByRole('button', { name: zh ? 'Save profile' : '保存档案', exact: true }).click();
    await expect(page).toHaveURL(`/${other}/me`);
    expect(await page.evaluate(() => localStorage.getItem('tianji.anon'))).not.toContain('1990');
  });
}
