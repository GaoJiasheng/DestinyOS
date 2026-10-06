import { testDatabaseUrl, sqliteClient } from '../../../scripts/sqlite-test';
import { expect, test } from '@playwright/test';
import contentRelease from '../../../packages/content/version.json' with { type: 'json' };

const db = sqliteClient(testDatabaseUrl(55432));
// DESIGN-GAP: Compile the cold health route outside the multi-step login case; all health assertions still run in that case.
test.beforeAll(async ({ request }) => {
  test.setTimeout(120_000);
  expect((await request.get('/api/v1/health')).status()).toBe(200);
});
test.afterAll(async () => {
  await db.$disconnect();
});

for (const locale of ['zh', 'en'] as const) {
  test(`${locale}: email login, scanner safety, single use and immediate session revocation`, async ({
    page,
    request,
    browser,
  }, testInfo) => {
    await request.post('http://127.0.0.1:58081/reset');
    const email = `${locale}-${testInfo.project.name}-${Date.now()}@example.com`;
    await page.addInitScript(() => localStorage.setItem('tianji-disclaimer-v1', 'accepted'));
    await page.goto(`/${locale}/auth/login`);
    const dialog = page.getByRole('dialog');
    if (await dialog.isVisible())
      await dialog
        .getByRole('button', { name: locale === 'zh' ? '我知道了' : 'I understand' })
        .click();
    await page.getByLabel(locale === 'zh' ? '邮箱地址' : 'Email address').fill(email);
    await page
      .getByRole('button', { name: locale === 'zh' ? '发送登录链接' : 'Send sign-in link' })
      .click();
    await expect(page.getByRole('status').filter({ hasText: email })).toBeVisible();
    const mails: unknown = await (await request.get('http://127.0.0.1:58081/mail')).json();
    if (!Array.isArray(mails)) throw new Error('Missing test outbox');
    const mail = mails.find(
      (entry: unknown) => entry && typeof entry === 'object' && 'to' in entry && entry.to === email,
    ) as { text: string; html: string } | undefined;
    if (!mail) throw new Error('No email delivered');
    const link = mail.text.match(/http:\/\/[^\s]+/)?.[0];
    if (!link) throw new Error('No magic link');
    expect(link).toContain(`/${locale}/auth/verify`);
    const verification = new URL(link);
    const tokenCount = await db.verificationToken.count({ where: { identifier: email } });
    expect(tokenCount).toBe(1);
    const scan = await request.get(link);
    expect(scan.ok()).toBe(true);
    expect(await db.verificationToken.count({ where: { identifier: email } })).toBe(1);
    const callback = new URL('/api/auth/callback/resend', link);
    callback.searchParams.set('email', email);
    callback.searchParams.set('token', verification.searchParams.get('token') ?? '');
    callback.searchParams.set('callbackUrl', `/${locale}`);
    const directScan = await request.get(callback.toString(), { maxRedirects: 0 });
    expect(directScan.status()).toBe(307);
    expect(await db.verificationToken.count({ where: { identifier: email } })).toBe(1);
    await page.goto(link);
    // DESIGN-GAP: Wait for the application hydration marker before exercising a bound Server Action after cold dev compilation.
    await expect(page.locator('html')).toHaveAttribute('data-fonts-settled', 'true');
    await page
      .getByRole('button', { name: locale === 'zh' ? '确认登录' : 'Confirm sign-in' })
      .click();
    await expect(page).toHaveURL(new RegExp(`/${locale}$`));
    const session: unknown = await (await page.request.get('/api/auth/session')).json();
    expect(session).toMatchObject({ user: { email, role: 'user', plan: 'free' } });
    const user = await db.user.findUniqueOrThrow({ where: { email } });
    expect(await db.session.count({ where: { userId: user.id } })).toBe(1);
    expect(await db.verificationToken.count({ where: { identifier: email } })).toBe(0);
    const second = await browser.newContext();
    const replay = await second.newPage();
    await replay.addInitScript(() => localStorage.setItem('tianji-disclaimer-v1', 'accepted'));
    await replay.goto(link);
    const replayDialog = replay.getByRole('dialog');
    if (await replayDialog.isVisible())
      await replayDialog
        .getByRole('button', { name: locale === 'zh' ? '我知道了' : 'I understand' })
        .click();
    await expect(replay.locator('html')).toHaveAttribute('data-fonts-settled', 'true');
    await replay
      .getByRole('button', { name: locale === 'zh' ? '确认登录' : 'Confirm sign-in' })
      .click();
    await expect(replay).toHaveURL(/auth\/login.*error=/);
    expect(await (await replay.request.get('/api/auth/session')).json()).toBeNull();
    await second.close();
    await db.session.deleteMany({ where: { userId: user.id } });
    expect(await (await page.request.get('/api/auth/session')).json()).toBeNull();
    const health = await request.get('/api/v1/health');
    expect(health.status()).toBe(200);
    expect(await health.json()).toMatchObject({
      ok: true,
      db: true,
      redis: true,
      knowledgeVersion: contentRelease.knowledgeVersion,
    });
  });
}

test('native email send returns 429 with retryAfter; admin allowlist and expired tokens', async ({
  request,
  page,
}) => {
  await request.post('http://127.0.0.1:58081/reset');
  const email = 'admin@example.com';
  const csrf: unknown = await (await request.get('/api/auth/csrf')).json();
  if (
    !csrf ||
    typeof csrf !== 'object' ||
    !('csrfToken' in csrf) ||
    typeof csrf.csrfToken !== 'string'
  )
    throw new Error('Missing CSRF token');
  for (let index = 0; index < 5; index++) {
    await request.post('/api/auth/signin/resend', {
      form: { email, csrfToken: csrf.csrfToken, callbackUrl: '/en' },
    });
  }
  const blocked = await request.post('/api/auth/signin/resend', {
    form: { email, csrfToken: csrf.csrfToken },
  });
  expect(blocked.status()).toBe(429);
  expect(Number(blocked.headers()['retry-after'])).toBeGreaterThan(0);
  expect(await blocked.json()).toMatchObject({
    ok: false,
    error: { code: 'E_RATE_LIMITED', details: { retryAfter: expect.any(Number) } },
  });
  const mails: unknown = await (await request.get('http://127.0.0.1:58081/mail')).json();
  if (!Array.isArray(mails)) throw new Error('Missing outbox');
  const latest = mails.at(-1) as { text: string };
  const link = latest.text.match(/http:\/\/[^\s]+/)?.[0];
  if (!link) throw new Error('Missing link');
  await page.addInitScript(() => localStorage.setItem('tianji-disclaimer-v1', 'accepted'));
  await page.goto(link);
  if (await page.getByRole('dialog').isVisible())
    await page.getByRole('dialog').getByRole('button', { name: 'I understand' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-fonts-settled', 'true');
  await page.getByRole('button', { name: 'Confirm sign-in' }).click();
  await expect(page).toHaveURL(/\/en$/);
  expect(await (await page.request.get('/api/auth/session')).json()).toMatchObject({
    user: { role: 'admin' },
  });
  await db.session.deleteMany({ where: { user: { email } } });
  await db.verificationToken.updateMany({
    where: { identifier: email },
    data: { expires: new Date(0) },
  });
  const expired = (mails[0] as { text: string }).text.match(/http:\/\/[^\s]+/)?.[0];
  if (!expired) throw new Error('Missing expired link');
  await page.goto(expired);
  await expect(page.locator('html')).toHaveAttribute('data-fonts-settled', 'true');
  await page.getByRole('button', { name: 'Confirm sign-in' }).click();
  await expect(page).toHaveURL(/auth\/login.*error=/);
  expect(await (await page.request.get('/api/auth/session')).json()).toBeNull();
});
