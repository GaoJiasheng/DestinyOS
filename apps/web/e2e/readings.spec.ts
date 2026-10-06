import { testDatabaseUrl, sqliteClient } from '../../../scripts/sqlite-test';
import { test, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
const db = sqliteClient(testDatabaseUrl(55432));
test.afterAll(() => db.$disconnect());
for (const locale of ['zh', 'en'] as const) {
  test(`${locale}: anonymous Fixture A → report → mock mail login → import → history`, async ({
    page,
    request,
  }, info) => {
    await request.post('http://127.0.0.1:58081/reset');
    await page.addInitScript(() => localStorage.setItem('tianji-disclaimer-v1', 'accepted'));
    await page.goto(`/${locale}/bazi/new`);
    await page.getByLabel(locale === 'zh' ? '年' : 'Year', { exact: true }).fill('1990');
    await page.getByLabel(locale === 'zh' ? '月' : 'Month', { exact: true }).fill('5');
    await page.getByLabel(locale === 'zh' ? '日' : 'Day', { exact: true }).fill('15');
    await page.getByLabel(locale === 'zh' ? '精确到分钟' : 'Exact time to the minute').check();
    await page
      .getByLabel(locale === 'zh' ? '出生时间' : 'Birth time', { exact: true })
      .fill('08:30');
    await page
      .getByRole('button', { name: locale === 'zh' ? '下一步' : 'Next', exact: true })
      .click();
    await page
      .getByLabel(locale === 'zh' ? '出生城市' : 'Birth city', { exact: true })
      .fill(locale === 'zh' ? '北京' : 'Beijing');
    await page.getByRole('option').filter({ hasText: 'Asia/Shanghai' }).first().click();
    await page
      .getByLabel(locale === 'zh' ? '性别' : 'Gender', { exact: true })
      .selectOption('male');
    await page.screenshot({
      path: `test-results/birth-${locale}-${info.project.name}.png`,
      fullPage: true,
    });
    const before = await db.reading.count();
    await page
      .getByRole('button', { name: locale === 'zh' ? '排盘' : 'Create reading', exact: true })
      .click();
    await expect(
      page
        .getByRole('status')
        .filter({ hasText: locale === 'zh' ? '正在推演' : 'Reading your time' }),
    ).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`/${locale}/bazi/r/local/`), { timeout: 90_000 });
    await expect(
      page.getByRole('heading', {
        name: locale === 'zh' ? '命盘概览' : 'Your Chart at a Glance',
        exact: true,
      }),
    ).toBeVisible();
    expect(await db.reading.count()).toBe(before);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
    const raw = await page.evaluate(() => localStorage.getItem('tianji.anon'));
    expect(raw).not.toContain('1990');
    expect(raw).not.toContain('Beijing');
    await mkdir('test-results', { recursive: true });
    await page.screenshot({
      path: `test-results/report-${locale}-${info.project.name}.png`,
      fullPage: true,
    });
    await page.screenshot({ path: `test-results/report-top-${locale}-${info.project.name}.png` });
    const term = page.locator('.report-paragraph .term-chip').first();
    await term.focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('.term-popover')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('.term-popover')).not.toBeVisible();
    await page
      .getByRole('button', {
        name: locale === 'zh' ? '专业视图' : 'Technical view',
        exact: true,
      })
      .click();
    await expect(
      page.getByRole('heading', {
        name: locale === 'zh' ? '专业视图' : 'Technical view',
        exact: true,
      }),
    ).toBeVisible();
    await page
      .getByRole('link', {
        name:
          locale === 'zh'
            ? '登录保存这份报告并解锁每日运势'
            : 'Sign in to save this report and unlock daily fortunes',
      })
      .click();
    const email = `reading-${locale}-${info.project.name}-${Date.now()}@example.com`;
    await page.getByLabel(locale === 'zh' ? '邮箱地址' : 'Email address').fill(email);
    await page
      .getByRole('button', {
        name: locale === 'zh' ? '发送登录链接' : 'Send sign-in link',
        exact: true,
      })
      .click();
    await expect(page.getByRole('status').filter({ hasText: email })).toBeVisible();
    const outbox = (await (await request.get('http://127.0.0.1:58081/mail')).json()) as {
      to: string;
      text: string;
    }[];
    const link = outbox.find((m) => m.to === email)?.text.match(/http:\/\/[^\s]+/)?.[0];
    if (!link) throw new Error('Missing test magic link');
    await page.goto(link);
    await page
      .getByRole('button', { name: locale === 'zh' ? '确认登录' : 'Confirm sign-in', exact: true })
      .click();
    await expect(page).toHaveURL(new RegExp(`/${locale}$`), { timeout: 30_000 });
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 30_000 });
    await page
      .getByRole('button', {
        name: locale === 'zh' ? '导入并保存' : 'Import and save',
        exact: true,
      })
      .click();
    await expect(page).toHaveURL(new RegExp(`/${locale}/me/history$`), { timeout: 60_000 });
    const history = page.locator('.history-list a').first();
    await expect(history).toBeVisible();
    expect(await page.evaluate(() => localStorage.getItem('tianji.anon'))).toBeNull();
    const user = await db.user.findUniqueOrThrow({ where: { email } });
    const rows = await db.reading.findMany({ where: { userId: user.id } });
    expect(rows).toHaveLength(1);
    expect(rows[0]?.encInput).toMatch(/^v1:/);
    expect(JSON.stringify(rows[0]?.chart)).not.toContain('1990-05-15');
    await history.click();
    await expect(
      page.getByRole('heading', {
        name: locale === 'zh' ? '命盘概览' : 'Your Chart at a Glance',
        exact: true,
      }),
    ).toBeVisible();
    await page.screenshot({
      path: `test-results/persisted-report-${locale}-${info.project.name}.png`,
      fullPage: true,
    });
  });
}
test('under 13 is blocked with a session cookie that prevents returning to the form', async ({
  page,
}) => {
  await page.addInitScript(() => localStorage.setItem('tianji-disclaimer-v1', 'accepted'));
  await page.goto('/zh/bazi/new');
  await page.getByLabel('年', { exact: true }).fill('2020');
  await page.getByRole('button', { name: '下一步', exact: true }).click();
  await expect(page).toHaveURL(/age-restricted$/);
  expect((await page.context().cookies()).find((c) => c.name === 'age_gate')).toMatchObject({
    value: 'blocked',
    httpOnly: true,
  });
  await page.goto('/zh/bazi/new');
  await expect(page).toHaveURL(/age-restricted$/);
  expect(await page.evaluate(() => localStorage.getItem('tianji.anon'))).toBeNull();
});
test('geography validates coordinate bounds and resolves local timezone data', async ({
  request,
}) => {
  const result = await request.get('/api/v1/geo/tz?lat=39.9&lng=116.4');
  expect(await result.json()).toEqual({ ok: true, data: { tz: 'Asia/Shanghai' } });
  expect((await request.get('/api/v1/geo/tz?lat=91&lng=0')).status()).toBe(400);
  expect((await request.get('/api/v1/geo/tz?lng=0')).status()).toBe(400);
});
