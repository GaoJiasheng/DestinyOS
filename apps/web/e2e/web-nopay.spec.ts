import { test, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { sqliteClient, testDatabaseUrl } from '../../../scripts/sqlite-test';
import zh from '../messages/zh.json' with { type: 'json' };
import en from '../messages/en.json' with { type: 'json' };
import tw from '../messages/zh-TW.json' with { type: 'json' };
const db = sqliteClient(testDatabaseUrl(57546));
test.afterAll(() => db.$disconnect());
for (const locale of ['zh', 'zh-TW', 'en'] as const) {
  const copy = locale === 'en' ? en : locale === 'zh-TW' ? tw : zh;
  test(`${locale}: App membership without Stripe, refresh skips missing provider`, async ({
    page,
    request,
    context,
  }, info) => {
    await page.addInitScript(() => localStorage.setItem('tianji-disclaimer-v1', 'accepted'));
    const providers: string[] = [];
    page.on('request', (req) => {
      if (/stripe\.com/.test(req.url())) providers.push(req.url());
    });
    await page.goto(`/${locale}/pricing`);
    await expect(page.getByText(copy['billing.appPrice'], { exact: true })).toBeVisible();
    await expect(
      page.getByRole('button', { name: copy['billing.openInApp'], exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: copy['billing.subscribe'], exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByRole('button', { name: copy['billing.buyLifetime'], exact: true }),
    ).toHaveCount(0);
    await page.getByRole('button', { name: copy['billing.openInApp'], exact: true }).click();
    await expect(page.getByText(new RegExp(copy['billing.storeSoon'])).first()).toBeVisible();
    await page.screenshot({ path: info.outputPath(`pricing-${locale}.png`), fullPage: true });
    const user = await db.user.create({
      data: { email: `${randomUUID()}@example.test`, plan: 'pro', lifetime: true },
    });
    const token = randomUUID();
    await db.session.create({
      data: {
        userId: user.id,
        sessionToken: token,
        expires: new Date(Date.now() + 3600000),
        authenticatedAt: new Date(),
      },
    });
    await context.addCookies([
      {
        name: '__Secure-authjs.session-token',
        value: token,
        domain: 'localhost',
        path: '/',
        secure: true,
        httpOnly: true,
        sameSite: 'Lax',
      },
    ]);
    await page.goto(`/${locale}/me/billing`);
    await expect(page.getByText(copy['billing.state.lifetime'], { exact: true })).toBeVisible();
    await expect(
      page.getByRole('button', { name: copy['me.billing.portal'], exact: true }),
    ).toHaveCount(0);
    await page
      .getByRole('button', { name: copy['billing.refreshMembership'], exact: true })
      .click();
    await expect(page.getByText(copy['billing.refreshSkipped'], { exact: true })).toBeVisible();
    await page.screenshot({ path: info.outputPath(`billing-${locale}.png`), fullPage: true });
    expect((await request.post('/api/v1/stripe/webhook', { data: {} })).status()).toBe(404);
    expect(providers).toEqual([]);
  });
}
