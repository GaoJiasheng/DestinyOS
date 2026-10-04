import { test, expect, type BrowserContext, type Page } from '@playwright/test';
import { audit, login, fillBirth, db, copies } from './m5-helpers';
for (const locale of ['zh', 'en'] as const)
  test.describe.serial(`${locale}: seven mobile main flows`, () => {
    let context: BrowserContext, page: Page, userId: string, readingId: string, token: string;
    const copy = copies[locale];
    test.beforeAll(async ({ browser }) => {
      context = await browser.newContext({
        baseURL: 'http://localhost:3230',
        viewport: { width: 375, height: 812 },
        isMobile: true,
        hasTouch: true,
        reducedMotion: 'reduce',
      });
      await context.addInitScript(() => localStorage.setItem('tianji-disclaimer-v1', 'accepted'));
      page = await context.newPage();
    });
    test.afterAll(async () => {
      await context?.close();
      await db.$disconnect();
    });
    test('1 anonymous calculation', async () => {
      await page.goto(`/${locale}/bazi/new`);
      await fillBirth(page, locale);
      await audit(page);
      await page.getByRole('button', { name: copy['form.birth.submit'], exact: true }).click();
      await expect(page).toHaveURL(new RegExp(`/${locale}/bazi/r/local/`), { timeout: 90000 });
      await expect(page.locator('.report-layout')).toBeVisible();
      await audit(page);
      expect(await page.evaluate(() => localStorage.getItem('tianji.anon'))).not.toContain('1990');
    });
    test('2 email sign-in', async ({ request }) => {
      const user = await login(page, request, locale);
      userId = user.id;
      await expect(page.getByRole('dialog')).toBeVisible();
      await audit(page);
    });
    test('3 save imported reading', async () => {
      await page.getByRole('button', { name: copy['report.import.confirm'], exact: true }).click();
      await expect(page).toHaveURL(new RegExp(`/${locale}/me/history$`));
      await expect(page.locator('.history-list a').first()).toBeVisible();
      const rows = await db.reading.findMany({ where: { userId } });
      expect(rows).toHaveLength(1);
      readingId = rows[0]!.id;
      expect(rows[0]!.encInput).toMatch(/^v1:/);
      await audit(page);
    });
    test('4 personalized daily fortune', async () => {
      for (const route of ['me', 'me/birth']) {
        await page.goto(`/${locale}/${route}`);
        await audit(page);
      }
      await page.goto(`/${locale}/today`);
      await expect(page.locator('[data-daily-block="10"] li')).toHaveCount(6);
      await expect(page.getByText(copy['daily.example'], { exact: true })).toHaveCount(0);
      await audit(page);
    });
    test('5 sharing and keyboard modal focus', async ({ request }) => {
      await page.goto(`/${locale}/bazi/r/${readingId}`);
      const trigger = page.getByRole('button', { name: copy['report.share'], exact: true });
      await trigger.focus();
      await page.keyboard.press('Enter');
      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible();
      await audit(page);
      for (let i = 0; i < 12; i++) {
        await page.keyboard.press('Tab');
        expect(await dialog.evaluate((el) => el.contains(document.activeElement))).toBe(true);
      }
      await dialog.getByRole('button', { name: copy['share.generate'], exact: true }).click();
      await expect(dialog.getByAltText(copy['share.preview'])).toBeVisible();
      token = (
        await db.shareLink.findFirstOrThrow({ where: { userId }, orderBy: { createdAt: 'desc' } })
      ).token;
      await page.keyboard.press('Escape');
      await expect(dialog).toHaveCount(0);
      await expect(trigger).toBeFocused();
      await page.goto(`/s/${token}?locale=${locale}`);
      await audit(page);
      const html = await (await request.get(`/s/${token}?locale=${locale}`)).text();
      expect(html).not.toMatch(/1990-05-15|08:30|Beijing|encBirth|encInput/);
    });
    test('6 subscription and cancellation', async ({ request }) => {
      await page.goto(`/${locale}/pricing`);
      await audit(page);
      await page.getByRole('button', { name: copy['billing.subscribe'], exact: true }).click();
      await expect(page).toHaveURL(/127.0.0.1:60302\/checkout/);
      await page.getByRole('button', { name: 'Complete test payment' }).click();
      await expect(page.getByText(copy['billing.activated'], { exact: true })).toBeVisible();
      expect((await db.user.findUniqueOrThrow({ where: { id: userId } })).plan).toBe('pro');
      await audit(page);
      await page.getByRole('button', { name: copy['me.billing.portal'], exact: true }).click();
      await page.getByRole('button', { name: 'Cancel renewal' }).click();
      await expect(page.getByText(copy['billing.canceledAtEnd'], { exact: true })).toBeVisible();
      const subscription = await db.subscription.findUniqueOrThrow({ where: { userId } });
      expect(
        (
          await request.get(`http://127.0.0.1:60302/expire?id=${subscription.stripeSubscriptionId}`)
        ).ok(),
      ).toBe(true);
      expect((await db.user.findUniqueOrThrow({ where: { id: userId } })).plan).toBe('free');
      const events = await db.event.findMany({
        select: { name: true, userHash: true, system: true, locale: true, plan: true },
      });
      for (const name of [
        'user.registered',
        'user.active',
        'reading.created',
        'daily.viewed',
        'share.created',
        'sub.started',
        'sub.ended',
      ])
        expect(events.some((event) => event.name === name)).toBe(true);
      expect(
        events.some(
          (event) =>
            event.name === 'reading.created' && event.locale === locale && event.system === 'bazi',
        ),
      ).toBe(true);
      expect(JSON.stringify(events)).not.toContain(userId);
    });
    test('7 account deletion revokes sessions/shares', async ({ request }) => {
      await page.goto(`/${locale}/me/settings`);
      await audit(page);
      await page.getByRole('button', { name: copy['me.delete'], exact: true }).click();
      await audit(page);
      await page.getByLabel(copy['me.deleteConfirm'], { exact: true }).fill('DELETE');
      await page.getByRole('button', { name: copy['me.deleteFinal'], exact: true }).click();
      await expect(page).toHaveURL(/auth\/login\?deleted=1/);
      expect(await db.session.count({ where: { userId } })).toBe(0);
      expect((await request.get(`/s/${token}`)).status()).toBe(404);
      expect((await db.user.findUniqueOrThrow({ where: { id: userId } })).deletedAt).not.toBeNull();
    });
  });
