import { testDatabaseUrl, sqliteClient } from '../../../scripts/sqlite-test';
import { test, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import zh from '../messages/zh.json' with { type: 'json' };
import en from '../messages/en.json' with { type: 'json' };
const db = sqliteClient(testDatabaseUrl(57542));
test.afterAll(async () => db.$disconnect());
for (const locale of ['zh', 'en'] as const) {
  const copy = locale === 'zh' ? zh : en;
  test(`${locale}: legal pages, secure headers, hosted subscription, portal cancellation and expiration`, async ({
    page,
    request,
  }, info) => {
    await page.addInitScript(() => localStorage.setItem('tianji-disclaimer-v1', 'accepted'));
    for (const legal of ['privacy', 'terms', 'disclaimer', 'credits']) {
      const response = await page.goto(`/${locale}/${legal}`);
      expect(response?.status()).toBe(200);
      expect(response?.headers()['x-content-type-options']).toBe('nosniff');
      expect(response?.headers()['content-security-policy-report-only']).toContain('nonce-');
      await expect(page.locator('main h1')).toHaveCount(1);
      expect((await page.locator('main').innerText()).length).toBeGreaterThan(180);
      await expect(page.locator('ins.adsbygoogle')).toHaveCount(0);
    }
    const email = `m4-${locale}-${randomUUID()}@example.test`;
    await page.goto(`/${locale}/auth/login`);
    await page.getByLabel(copy['auth.login.email']).fill(email);
    await page.getByRole('button', { name: copy['auth.login.send'], exact: true }).click();
    await expect(page.getByRole('status').filter({ hasText: email })).toBeVisible();
    const outbox = (await (await request.get('http://127.0.0.1:60191/mail')).json()) as Array<{
      to: string;
      text: string;
    }>;
    const link = outbox.find((m) => m.to === email)?.text.match(/http:\/\/[^\s]+/)?.[0];
    if (!link) throw new Error('Missing test magic link');
    await page.goto(link);
    await page.getByRole('button', { name: copy['auth.verify.confirm'], exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`/${locale}$`));
    await page.goto(`/${locale}/pricing`);
    await page.getByRole('button', { name: copy['billing.yearly'], exact: true }).click();
    await page.screenshot({ path: info.outputPath('pricing.png'), fullPage: true });
    await page.getByRole('button', { name: copy['billing.subscribe'], exact: true }).click();
    await expect(page).toHaveURL(/127.0.0.1:60282\/checkout/);
    await page.getByRole('button', { name: 'Complete test payment' }).click();
    await expect(page).toHaveURL(new RegExp(`/${locale}/me/billing\\?status=success`));
    await expect(page.getByText(copy['billing.activated'], { exact: true })).toBeVisible();
    await page.screenshot({ path: info.outputPath('billing.png'), fullPage: true });
    const user = await db.user.findUniqueOrThrow({ where: { email } });
    expect(user.plan).toBe('pro');
    let sub = await db.subscription.findUniqueOrThrow({ where: { userId: user.id } });
    expect(sub.stripePriceId).toBe('price_yearly_test');
    await page.getByRole('button', { name: copy['me.billing.portal'], exact: true }).click();
    await page.getByRole('button', { name: 'Cancel renewal' }).click();
    await expect(page.getByText(copy['billing.canceledAtEnd'], { exact: true })).toBeVisible();
    expect((await db.user.findUniqueOrThrow({ where: { id: user.id } })).plan).toBe('pro');
    sub = await db.subscription.findUniqueOrThrow({ where: { userId: user.id } });
    expect(
      (await request.post(`http://127.0.0.1:60282/expire?id=${sub.stripeSubscriptionId}`)).ok(),
    ).toBe(true);
    await page.reload();
    expect((await db.user.findUniqueOrThrow({ where: { id: user.id } })).plan).toBe('free');
    await expect(
      page.locator('main').getByText(copy['me.plan.free'], { exact: true }),
    ).toBeVisible();
    const exported = await page.request.get('/api/v1/me/export');
    expect(exported.ok()).toBe(true);
    expect((await page.request.get('/api/v1/me/export')).status()).toBe(429);
    expect((await request.get('/api/v1/cron/daily-maintenance')).status()).toBe(401);
    const dueEmail = `due-${randomUUID()}@example.test`;
    const due = await db.user.create({
      data: { email: dueEmail, deletedAt: new Date(Date.now() - 8 * 86400000) },
    });
    await db.verificationToken.create({
      data: { identifier: dueEmail, token: randomUUID(), expires: new Date() },
    });
    await db.feedback.create({
      data: { text: 'test@example.test 1990-05-15 +1 415 555 0100', vote: 1 },
    });
    expect(
      (
        await request.get('/api/v1/cron/daily-maintenance', {
          headers: { Authorization: 'Bearer isolated-cron-secret' },
        })
      ).ok(),
    ).toBe(true);
    expect(await db.user.findUnique({ where: { id: due.id } })).toBeNull();
    expect(await db.verificationToken.count({ where: { identifier: dueEmail } })).toBe(0);
    const audits = await db.adminAuditLog.findMany();
    expect(JSON.stringify(audits)).not.toContain(dueEmail);
    expect(JSON.stringify(audits)).not.toContain(due.id);
    const feedback = await db.feedback.findMany({ where: { userId: null } });
    expect(feedback.every((f) => !f.text?.includes('test@example.test'))).toBe(true);
    expect(await db.adminAuditLog.count({ where: { action: 'feedback.scrub' } })).toBeGreaterThan(
      0,
    );
  });
}
