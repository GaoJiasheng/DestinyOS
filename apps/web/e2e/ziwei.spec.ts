import { testDatabaseUrl, sqliteClient } from '../../../scripts/sqlite-test';
import { test, expect, type Locator, type Page } from '@playwright/test';
async function settleFonts(page: Page) {
  await expect(page.locator('html')).toHaveAttribute('data-fonts-settled', 'true', {
    timeout: 15_000,
  });
  await page.evaluate(() => document.fonts.ready);
}
// DESIGN-GAP: Remove sidebar scrolling only during component captures so the baseline includes all twelve cells.
async function chartScreenshot(page: Page, board: Locator, name: string) {
  const style = await page.addStyleTag({
    content:
      '.report-chart { position: static !important; max-height: none !important; overflow: visible !important; }',
  });
  try {
    await settleFonts(page);
    // DESIGN-GAP: Collect independent chart baseline differences without skipping later interaction checks; any soft mismatch still fails the test.
    await expect.soft(board).toHaveScreenshot(name);
  } finally {
    await style.evaluate((element) => element.parentNode?.removeChild(element));
  }
}
const db = sqliteClient(testDatabaseUrl(55466));
test.afterAll(() => db.$disconnect());
for (const locale of ['zh', 'en'] as const) {
  test(`${locale}: Fixture A → Zi Wei report → palace/annual/zoom → saved report`, async ({
    page,
    request,
  }, info) => {
    await request.post('http://127.0.0.1:58115/reset');
    await page.addInitScript(() => localStorage.setItem('tianji-disclaimer-v1', 'accepted'));
    await page.goto(`/${locale}/ziwei/new`);
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
    const before = await db.reading.count();
    await page
      .getByRole('button', { name: locale === 'zh' ? '排盘' : 'Create reading', exact: true })
      .click();
    await expect(page).toHaveURL(new RegExp(`/${locale}/ziwei/r/local/`), { timeout: 90_000 });
    await expect(page.locator('.report-section')).toHaveCount(9);
    const chart = page.locator('.report-chart');
    const board = chart.getByTestId('ziwei-board');
    await expect(board.locator('.ziwei-palace')).toHaveCount(12);
    await expect(board.locator('[data-related="true"]')).toHaveCount(4);
    expect(await db.reading.count()).toBe(before);
    const expectViewport = async () => {
      await expect
        .poll(() => page.evaluate(() => document.documentElement.scrollWidth))
        .toBe(page.viewportSize()!.width);
    };
    await expectViewport();
    await page.evaluate(() => document.fonts.ready);
    await chartScreenshot(page, board, `ziwei-${locale}-natal.png`);
    await chart
      .getByRole('checkbox', { name: locale === 'zh' ? '叠加流年' : 'Show yearly overlay' })
      .check();
    await expect(board.locator('.ziwei-annual')).toHaveCount(1);
    await expectViewport();
    await board.locator('[data-palace="wealth"]').click();
    if (info.project.name === 'mobile') {
      await expect(page.getByRole('dialog')).toBeVisible();
    } else {
      await expect(board.locator('[data-palace="wealth"]')).toHaveAttribute('aria-pressed', 'true');
      await chartScreenshot(page, board, `ziwei-${locale}-annual-wealth.png`);
      await chart
        .getByRole('button', { name: locale === 'zh' ? '全屏查看命盘' : 'Open fullscreen chart' })
        .click();
    }
    const dialog = page.getByRole('dialog');
    const expanded = dialog.getByTestId('ziwei-board');
    await expanded.locator('[data-palace="career"]').click();
    await expect(expanded.locator('[data-palace="career"]')).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expect(expanded.locator('[data-related="true"]')).toHaveCount(4);
    await settleFonts(page);
    await expect
      .soft(dialog.locator('.ziwei-viewport'))
      .toHaveScreenshot(`ziwei-${locale}-fullscreen.png`);
    await dialog.getByRole('slider').fill('200');
    await expect(expanded).toHaveCSS(
      'width',
      `${await dialog.locator('.ziwei-viewport').evaluate((e) => e.clientWidth * 2)}px`,
    );
    // Verify the touch gesture handler with two pointer contacts, then one-contact panning.
    const viewport = dialog.locator('.ziwei-viewport');
    await viewport.evaluate((element) => {
      const emit = (type: string, id: number, x: number, y: number) =>
        element.dispatchEvent(
          new PointerEvent(type, {
            bubbles: true,
            pointerId: id,
            pointerType: 'touch',
            clientX: x,
            clientY: y,
          }),
        );
      element.setPointerCapture = () => {};
      emit('pointerdown', 1, 100, 100);
      emit('pointerdown', 2, 200, 100);
      emit('pointermove', 2, 210, 100);
      emit('pointermove', 2, 250, 100);
      emit('pointerup', 2, 250, 100);
      emit('pointermove', 1, 50, 50);
      emit('pointerup', 1, 50, 50);
    });
    expect(Number(await dialog.getByRole('slider').inputValue())).toBeGreaterThan(200);
    expect(await viewport.evaluate((e) => e.scrollLeft)).toBeGreaterThan(0);
    await dialog.getByRole('button', { name: locale === 'zh' ? '重置视图' : 'Reset view' }).click();
    await expect(dialog.getByRole('slider')).toHaveValue('100');
    await expectViewport();
    await dialog
      .getByRole('button', { name: locale === 'zh' ? '关闭' : 'Close', exact: true })
      .click();
    await expect(dialog).not.toBeVisible();
    await chart.getByRole('checkbox').uncheck();
    await expect(board.locator('.ziwei-annual')).toHaveCount(0);
    await page
      .getByRole('button', { name: locale === 'zh' ? '专业视图' : 'Technical view', exact: true })
      .click();
    await expect(
      chart.getByText(locale === 'zh' ? '十二神' : 'Twelve-star cycles', { exact: true }),
    ).toBeVisible();
    const raw = await page.evaluate(() => localStorage.getItem('tianji.anon'));
    expect(raw).not.toContain('1990');
    expect(raw).not.toContain('Beijing');
    await page.reload();
    await expect(board.locator('.ziwei-palace')).toHaveCount(12);
    // Locale switching translates the saved chart, preserving the palace layout.
    const branches = await board
      .locator('.ziwei-palace')
      .evaluateAll((cells) => cells.map((c) => c.getAttribute('data-branch')));
    const other = locale === 'zh' ? 'en' : 'zh';
    await page.goto(page.url().replace(`/${locale}/`, `/${other}/`));
    await expect(board.locator('[data-palace="life"] .ziwei-seal')).toHaveText(
      other === 'zh' ? '命宫' : 'Life',
    );
    await expect(board.locator('.ziwei-palace')).toHaveCount(12);
    expect(
      await board
        .locator('.ziwei-palace')
        .evaluateAll((cells) => cells.map((c) => c.getAttribute('data-branch'))),
    ).toEqual(branches);
    await page.goto(page.url().replace(`/${other}/`, `/${locale}/`));
    await expect(board.locator('[data-palace="life"] .ziwei-seal')).toHaveText(
      locale === 'zh' ? '命宫' : 'Life',
    );
    // DESIGN-GAP: Seed a real database-backed Auth.js session for report persistence; production intentionally ignores the test mail sink.
    const email = `ziwei-${locale}-${info.project.name}-${Date.now()}@example.com`;
    const user = await db.user.create({ data: { email, emailVerified: new Date(), locale } });
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
    expect(await (await page.request.get('/api/auth/session')).json()).toMatchObject({
      user: { id: user.id },
    });
    await page.goto(`/${locale}`);
    await expect(page.getByRole('dialog')).toBeVisible();
    await page
      .getByRole('button', {
        name: locale === 'zh' ? '导入并保存' : 'Import and save',
        exact: true,
      })
      .click();
    await expect(page).toHaveURL(new RegExp(`/${locale}/me/history$`), { timeout: 60_000 });
    await page.locator('.history-list a').first().click();
    await expect(board.locator('.ziwei-palace')).toHaveCount(12);
    await expect(page.locator('.report-section')).toHaveCount(9);
    const saved = await db.reading.findMany({ where: { userId: user.id } });
    expect(saved).toHaveLength(1);
    expect(saved[0]?.system).toBe('ziwei');
    expect(saved[0]?.encInput).toMatch(/^v1:/);
  });
  test(`${locale}: no birth time blocks creation with bilingual recovery`, async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('tianji-disclaimer-v1', 'accepted'));
    await page.goto(`/${locale}/ziwei/new`);
    await page
      .getByLabel(locale === 'zh' ? '我不知道出生时间' : "I don't know my birth time", {
        exact: true,
      })
      .check();
    await expect(page.locator('.ziwei-time-required')).toBeVisible();
    await expect(
      page.getByRole('button', { name: locale === 'zh' ? '下一步' : 'Next', exact: true }),
    ).toBeDisabled();
    await expect(
      page.getByRole('link', { name: locale === 'zh' ? '先看八字' : 'Explore BaZi', exact: true }),
    ).toHaveAttribute('href', `/${locale}/bazi/new`);
    await settleFonts(page);
    await expect(page.locator('.ziwei-time-required')).toHaveScreenshot(
      `ziwei-${locale}-no-time.png`,
    );
    expect(await page.evaluate(() => localStorage.getItem('tianji.anon'))).toBeNull();
  });
}
