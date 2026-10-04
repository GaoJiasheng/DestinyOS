import { test, expect } from '@playwright/test';
// DESIGN-GAP: Use the existing isolated readings harness for real Server Actions and encrypted anonymous storage.
for (const locale of ['zh', 'en'] as const) {
  const zh = locale === 'zh';
  test(`${locale}: divination iching coins → ritual → local report → reload`, async ({
    page,
  }, info) => {
    await page.addInitScript(() => localStorage.setItem('tianji-disclaimer-v1', 'accepted'));
    await page.goto(`/${locale}/iching`);
    await page.getByRole('link', { name: zh ? '六爻 · 铜钱摇卦' : 'Liuyao · Coins' }).click();
    await page.getByLabel(zh ? '问题（可选）' : 'Question (optional)').fill('private-question-t35');
    await page.getByRole('button', { name: zh ? '事业' : 'Career', exact: true }).click();
    await page
      .getByRole('button', { name: zh ? '下一步 · 开始仪式' : 'Continue to the ritual' })
      .click();
    await page.getByRole('button', { name: zh ? '摇' : 'Shake', exact: true }).click();
    await expect(page.getByRole('status')).toContainText('1 / 6');
    await expect(
      page.getByRole('button', { name: zh ? '一键摇完' : 'Cast all six' }),
    ).toBeEnabled();
    await page.getByRole('button', { name: zh ? '一键摇完' : 'Cast all six' }).click();
    await expect(page).toHaveURL(new RegExp(`/${locale}/iching/r/local/`), { timeout: 90000 });
    await expect(page.getByTestId('liuyao-table')).toBeVisible();
    await expect(
      page.locator('.report-body .report-section:not(#section-summary_actions)'),
    ).toHaveCount(6);
    await expect(page.getByTestId('liuyao-table').locator('tbody tr')).toHaveCount(6);
    expect(await page.evaluate(() => localStorage.getItem('tianji.anon'))).not.toContain(
      'private-question-t35',
    );
    expect(page.url()).not.toContain('private-question-t35');
    const lines = await page.locator('.report-chart .hexagram-lines').first().innerHTML();
    await page.reload();
    await expect(page.getByTestId('liuyao-table')).toBeVisible();
    expect(await page.locator('.report-chart .hexagram-lines').first().innerHTML()).toBe(lines);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({
      path: `test-results/t35-iching-${locale}-${info.project.name}.png`,
      fullPage: true,
    });
  });
  test(`${locale}: divination qimen parameters → lighting → indicators → compass`, async ({
    page,
  }, info) => {
    await page.addInitScript(() => localStorage.setItem('tianji-disclaimer-v1', 'accepted'));
    await page.goto(`/${locale}/qimen`);
    await page.getByLabel(zh ? '起局时刻' : 'Casting time').fill('2026-10-04T15:30');
    await page.getByLabel(zh ? '所在时区' : 'Time zone').fill('Asia/Shanghai');
    await page.getByRole('button', { name: zh ? '财运' : 'Wealth', exact: true }).click();
    await page.getByRole('button', { name: zh ? '起局' : 'Cast Qimen', exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`/${locale}/qimen/r/local/`), { timeout: 90000 });
    const grid = page.getByTestId('qimen-chart');
    await expect(grid.locator('.qimen-palace')).toHaveCount(9);
    await expect(grid.locator('.use-god-palace').first()).toBeVisible();
    await expect(
      grid.locator('.use-god-label').filter({ hasText: zh ? '生门' : 'Life' }),
    ).toBeVisible();
    await expect(grid.locator('.favorable-sector').first()).toBeVisible();
    await expect(grid.locator('.qimen-palace').first()).toContainText(zh ? '东南' : 'SE');
    await grid
      .getByRole('button', { name: zh ? '上南 · 切换方位' : 'South up · Change orientation' })
      .click();
    await expect(grid.locator('.qimen-palace').first()).toContainText(zh ? '西北' : 'NW');
    await expect(
      page.locator('.report-body .report-section:not(#section-summary_actions)'),
    ).toHaveCount(6);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({
      path: `test-results/t35-qimen-${locale}-${info.project.name}.png`,
      fullPage: true,
    });
  });
  for (const method of ['time', 'numbers', 'random'] as const) {
    test(`${locale}: divination meihua ${method} → report${method === 'numbers' ? ' offline' : ''}`, async ({
      page,
      context,
    }) => {
      await page.addInitScript(() => localStorage.setItem('tianji-disclaimer-v1', 'accepted'));
      await page.goto(`/${locale}/iching/cast?method=${method}`);
      await page
        .getByRole('button', { name: zh ? '下一步 · 开始仪式' : 'Continue to the ritual' })
        .click();
      if (method === 'numbers') {
        await page
          .getByRole('button', { name: zh ? '以这些数字起卦' : 'Cast these numbers' })
          .click();
        await expect(
          page.getByRole('alert').filter({ hasText: zh ? '请输入' : 'Enter 2–3' }),
        ).toBeVisible();
        await page.getByLabel(zh ? '第 1 个数' : 'Number 1').fill('3');
        await page.getByLabel(zh ? '第 2 个数' : 'Number 2').fill('5');
        await page.getByLabel(zh ? '第 3 个数' : 'Number 3').fill('1');
        await context.setOffline(true);
      } else if (method === 'time') {
        await expect(page.locator('.notice')).toContainText(zh ? '农历' : 'Lunar');
      }
      await page
        .getByRole('button', {
          name: zh
            ? method === 'time'
              ? '以此刻起卦'
              : method === 'numbers'
                ? '以这些数字起卦'
                : '抛掷'
            : method === 'time'
              ? 'Cast at this time'
              : method === 'numbers'
                ? 'Cast these numbers'
                : 'Toss',
          exact: true,
        })
        .click();
      await expect(page).toHaveURL(new RegExp(`/${locale}/iching/r/local/`), { timeout: 90000 });
      await expect(page.getByTestId('body-use')).toBeVisible();
      await expect(page.locator('.report-chart .hexagram-figure')).toHaveCount(3);
      if (method === 'numbers') {
        await context.setOffline(false);
        await page.reload();
        await expect(page.getByTestId('body-use')).toBeVisible();
      }
    });
  }
}
