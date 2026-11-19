import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { testDatabaseUrl, sqliteClient } from '../../../scripts/sqlite-test';
import { test, expect, type Page } from '@playwright/test';
import { printSettled } from '../lib/platform/print-dom';
// Runs only through playwright.emphasis.config.ts, whose server sets FEATURE_EMPHASIS=true.
const db = sqliteClient(testDatabaseUrl(57732));
test.afterAll(() => db.$disconnect());
// Optional review captures for the pilot sign-off; ordinary runs write nothing.
const shots = process.env.EMPHASIS_SHOTS_DIR;
if (shots) mkdirSync(shots, { recursive: true });
const shot = (name: string) => (shots ? { path: join(shots, name) } : {});
const levels = (page: Page) => page.locator('.report-emphasis .emphasis-level').allTextContents();
async function settle(page: Page) {
  await expect(page.locator('html')).toHaveAttribute('data-fonts-settled', 'true', {
    timeout: 15_000,
  });
  await page.evaluate(() => document.fonts.ready);
}
async function createFixtureA(page: Page) {
  await page.addInitScript(() => localStorage.setItem('tianji-disclaimer-v1', 'accepted'));
  await page.goto('/zh/ziwei/new');
  await page.getByLabel('年', { exact: true }).fill('1990');
  await page.getByLabel('月', { exact: true }).fill('5');
  await page.getByLabel('日', { exact: true }).fill('15');
  await page.getByLabel('精确到分钟').check();
  await page.getByLabel('出生时间', { exact: true }).fill('08:30');
  await page.getByRole('button', { name: '下一步', exact: true }).click();
  await page.getByLabel('出生城市', { exact: true }).fill('北京');
  await page.getByRole('option').filter({ hasText: 'Asia/Shanghai' }).first().click();
  await page.getByLabel('性别', { exact: true }).selectOption('male');
  await page.getByRole('button', { name: '排盘', exact: true }).click();
  await expect(page).toHaveURL(/\/zh\/ziwei\/r\/local\//, { timeout: 90_000 });
}
async function signIn(page: Page, tag: string) {
  const user = await db.user.create({
    data: { email: `emphasis-${tag}-${Date.now()}@example.com`, emailVerified: new Date() },
  });
  const sessionToken = crypto.randomUUID();
  await db.session.create({
    data: { sessionToken, userId: user.id, expires: new Date(Date.now() + 3_600_000) },
  });
  await page.context().addCookies([
    {
      name: '__Secure-authjs.session-token',
      value: sessionToken,
      domain: 'localhost',
      path: '/',
      httpOnly: true,
      secure: true,
      sameSite: 'Lax',
    },
  ]);
  return user;
}

test('anonymous Fixture A shows the emphasis module, its basis and the same bands in English', async ({
  page,
  request,
}, info) => {
  await request.post('http://127.0.0.1:60381/reset');
  // Review captures use the 390px phone width; the regular mobile project stays at 375px.
  if (shots && info.project.name === 'mobile')
    await page.setViewportSize({ width: 390, height: 844 });
  await createFixtureA(page);
  const module = page.locator('.report-emphasis');
  await expect(module.getByRole('heading', { name: '命盘侧重' })).toBeVisible();
  await expect(module.locator('.emphasis-dim')).toHaveCount(4);
  expect(await levels(page)).toEqual(['有支撑', '多花心思', '平稳', '有支撑']);
  await expect(module.locator('.emphasis-overview')).toHaveText('你的盘面侧重在事业与人际。');
  await expect(module).toContainText('本命盘不评估健康。');
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth))
    .toBe(page.viewportSize()!.width);
  const summary = module.locator('[data-dim="wealth"] summary');
  expect((await summary.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await settle(page);
  await module.scrollIntoViewIfNeeded();
  await module.screenshot(shot(`zh-${info.project.name}-module-collapsed.png`));
  await summary.click();
  const basis = module.locator('[data-dim="wealth"] .emphasis-basis li');
  await expect(basis).toHaveCount(4);
  await expect(basis.first()).toContainText('+');
  await expect(module.locator('[data-dim="wealth"] summary')).toHaveText('收起依据');
  await module.screenshot(shot(`zh-${info.project.name}-module-wealth-expanded.png`));
  expect(await page.locator('body').innerText()).not.toContain('/5');
  // A locale switch translates the saved chart and re-renders the stored bands, never recomputes them.
  await page.goto(page.url().replace('/zh/', '/en/'));
  await expect(page.locator('.report-emphasis .emphasis-dim')).toHaveCount(4);
  expect(await levels(page)).toEqual(['Supported', 'Takes more care', 'Steady', 'Supported']);
  expect(await page.locator('body').innerText()).not.toContain('/5');
  const stored = await page.evaluate(() => localStorage.getItem('tianji.anon'));
  expect(stored).not.toContain('1990');
  if (info.project.name === 'desktop') {
    await settle(page);
    await page.locator('.report-emphasis').scrollIntoViewIfNeeded();
    await page.locator('.report-emphasis').screenshot(shot('en-desktop-module.png'));
  }
});

test('signed-in import, print and public share expose only the strongest dimension', async ({
  page,
  request,
}, info) => {
  test.skip(info.project.name !== 'desktop', 'One account flow covers the persisted paths.');
  await request.post('http://127.0.0.1:60381/reset');
  await createFixtureA(page);
  const user = await signIn(page, info.project.name);
  await page.goto('/zh');
  await page.getByRole('button', { name: '导入并保存', exact: true }).click();
  await expect(page).toHaveURL(/\/zh\/me\/history$/, { timeout: 60_000 });
  const reading = await db.reading.findFirstOrThrow({ where: { userId: user.id } });
  expect(JSON.stringify(reading.reportZh)).toContain('"emphasis"');
  await page.goto(`/zh/ziwei/r/${reading.id}`);
  await expect(page.locator('.report-emphasis .emphasis-dim')).toHaveCount(4);
  expect(await levels(page)).toEqual(['有支撑', '多花心思', '平稳', '有支撑']);
  await page.goto(`/zh/ziwei/r/${reading.id}/print`);
  await expect.poll(() => page.evaluate(printSettled), { timeout: 60_000 }).toBe(true);
  const printed = page.locator('.print-pages [data-dim="wealth"] .print-emphasis-level');
  await expect(printed).toHaveText('多花心思');
  expect(await page.locator('.print-pages').innerText()).not.toContain('/5');
  if (shots)
    await page
      .locator('.print-sheet')
      .filter({ has: page.locator('[data-dim]') })
      .first()
      .screenshot(shot('zh-print-emphasis-sheet.png'));
  await page.goto(`/zh/ziwei/r/${reading.id}`);
  await page.getByRole('button', { name: '分享', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: '生成分享卡', exact: true }).click();
  await expect(dialog.getByAltText('分享卡预览')).toBeVisible({ timeout: 60_000 });
  const { token } = await db.shareLink.findFirstOrThrow({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' },
  });
  await page.goto(`/s/${token}?locale=zh`);
  const card = page.locator('.share-emphasis');
  await expect(card).toHaveText(/命盘侧重\s*事业 · 有支撑/);
  await expect(card).toHaveAttribute('data-dim', 'career');
  const html = await (await request.get(`/s/${token}?locale=zh`)).text();
  for (const hidden of ['多花心思', '人际 · ', '财富 · ', '感情 · ', 'zw.z', 'ruleId', '"basis"'])
    expect(html).not.toContain(hidden);
  expect(await page.locator('body').innerText()).not.toContain('平稳');
  expect(await page.locator('body').innerText()).not.toContain('/5');
  if (shots) await page.screenshot({ ...shot('zh-share-page.png'), fullPage: true });
  const image = await request.get(`/api/v1/og/share/${token}?format=landscape&locale=zh`);
  expect(image.status()).toBe(200);
  if (shots) {
    const { writeFileSync } = await import('node:fs');
    writeFileSync(join(shots, 'zh-share-og-card.png'), await image.body());
  }
});
