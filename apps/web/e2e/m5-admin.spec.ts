import { m5BaseURL } from '../../../scripts/m5-test-urls';
import { testDatabaseUrl } from '../../../scripts/sqlite-test';
import { test, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { parse, stringify } from 'yaml';
import { audit, login, mailLink, db, copies, seedReading, fillBirth, birth } from './m5-helpers';
import type { KnowledgeUnit } from '@tianji/content';
import { TestCache } from '../../../scripts/test-cache';
import { encryptField } from '../lib/crypto';
const cache = new TestCache(testDatabaseUrl(57552));
test.afterAll(async () => {
  await db.$disconnect();
  cache.disconnect();
});
test('admin: 404, safe users, re-auth, draft→fixture→release→rollback, config, feedback, audits and aggregates', async ({
  page,
  request,
}) => {
  test.setTimeout(300000);
  await page.addInitScript(() => localStorage.setItem('tianji-disclaimer-v1', 'accepted'));
  for (const path of [
    '/admin',
    '/admin/users',
    '/admin/knowledge',
    '/admin/config',
    '/admin/audit',
    '/admin/re-auth',
  ]) {
    const response = await page.goto(path);
    expect(response?.status()).toBe(404);
    expect(response?.headers()['x-robots-tag']).toContain('noindex');
  }
  const normal = await login(page, request, 'zh');
  await db.birthProfile.create({
    data: {
      userId: normal.id,
      encBirth: encryptField(JSON.stringify(birth), 'BirthProfile.encBirth', normal.id),
      encPlace: encryptField(
        JSON.stringify({ ...birth.place, name: 'PrivateOnlyTown' }),
        'BirthProfile.encPlace',
        normal.id,
      ),
      birthYear: 1990,
      tz: 'Asia/Shanghai',
      gender: 'male',
      timeUnknown: false,
      chartHash: 'isolated-m5-profile',
    },
  });
  expect((await page.goto('/admin'))?.status()).toBe(404);
  // Log in to the allowlisted account through its real provider, rather than inventing an admin cookie.
  const admin = await login(page, request, 'zh', 'admin@example.com');
  await page.goto('/admin');
  await audit(page);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
  for (const route of ['/admin/users', '/admin/knowledge']) {
    await page.goto(route);
    await audit(page);
  }
  await db.session.updateMany({
    where: { userId: admin.id },
    data: { authenticatedAt: new Date(Date.now() - 11 * 60000) },
  });
  await page.goto('/admin/users');
  await expect(page).toHaveURL(/\/admin\/re-auth$/);
  await audit(page);
  await page.getByRole('button', { name: copies.zh['admin.reauth.email'], exact: true }).click();
  await expect(page.getByRole('status')).toHaveText(copies.zh['admin.saved']);
  const reauth = await mailLink(request, 'admin@example.com');
  expect(reauth).toContain('returnTo=');
  await page.goto(reauth);
  await page.getByRole('button', { name: copies.zh['auth.verify.confirm'], exact: true }).click();
  await expect(page).toHaveURL(/\/admin$/);
  await page.goto(`/admin/users/${normal.id}`);
  await audit(page);
  const body = await page.content();
  expect(body).not.toMatch(/encBirth|encPlace|encInput|PrivateOnlyTown|08:30/);
  await page.getByLabel(copies.zh['admin.users.plan'], { exact: true }).selectOption('pro');
  await page.getByRole('button', { name: copies.zh['admin.users.setPlan'], exact: true }).click();
  await expect(page.getByRole('status').first()).toHaveText(copies.zh['admin.saved']);
  expect((await db.user.findUniqueOrThrow({ where: { id: normal.id } })).plan).toBe('pro');
  await page.getByRole('button', { name: copies.zh['admin.users.export'], exact: true }).click();
  await expect(page.getByRole('status')).toHaveCount(2);
  const exportUrl = await mailLink(request, normal.email!);
  expect((await page.request.get(exportUrl)).status()).toBe(404);
  const unitId = 'bazi.day_master.geng';
  await page.goto(`/admin/knowledge/${unitId}`);
  const editor = page.getByLabel(copies.zh['admin.ku.yaml']);
  await expect(editor).toBeVisible();
  const units = parse(await editor.inputValue()) as KnowledgeUnit[];
  const unit = units[0]!;
  const originalTitle = unit.zh.title;
  unit.zh.title = `${originalTitle} M5`;
  unit.en.title = `${unit.en.title} M5`;
  await editor.fill(stringify([unit]));
  await expect(page.getByText(copies.zh['admin.ku.valid'], { exact: true })).toBeVisible();
  await page.getByRole('button', { name: copies.zh['admin.ku.saveDraft'], exact: true }).click();
  await expect(page.getByRole('status')).toHaveText(copies.zh['admin.saved']);
  await page
    .getByRole('button', { name: copies.zh['admin.ku.previewFixture'], exact: true })
    .click();
  await expect(page.getByText(copies.zh['admin.ku.matched'], { exact: true })).toHaveCount(2);
  await expect(page.locator('.admin-matched')).not.toHaveCount(0);
  await audit(page);
  const old = await seedReading(normal.id, 'bazi', 'zh');
  await page.goto('/admin/knowledge/releases');
  await audit(page);
  await page
    .getByLabel(copies.zh['admin.release.notes'])
    .fill('M5 bilingual editorial verification');
  await page
    .getByRole('button', { name: copies.zh['admin.release.preflight'], exact: true })
    .click();
  await expect(page.getByText(copies.zh['admin.release.ready'], { exact: true })).toBeVisible({
    timeout: 90000,
  });
  await page.getByRole('button', { name: copies.zh['admin.release.publish'], exact: true }).click();
  await expect(page.getByRole('status')).toContainText('knowledgeVersion');
  const release = await db.knowledgeRelease.findFirstOrThrow({
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
  });
  expect((await db.reading.findUniqueOrThrow({ where: { id: old.id } })).knowledgeVersion).toBe(
    old.knowledgeVersion,
  );
  const knowledgeKey = `knowledge:${release.version}:bazi:zh`;
  expect(await cache.exists(knowledgeKey)).toBe(1);
  const published = JSON.parse((await cache.get(knowledgeKey))!) as { units: KnowledgeUnit[] };
  expect(published.units.find((u) => u.id === unitId)?.zh.title).toContain('M5');
  const ownerContext = await page
    .context()
    .browser()!
    .newContext({
      baseURL: m5BaseURL,
      viewport: { width: 375, height: 812 },
      reducedMotion: 'reduce',
    });
  const ownerPage = await ownerContext.newPage();
  await ownerPage.addInitScript(() => localStorage.setItem('tianji-disclaimer-v1', 'accepted'));
  await login(ownerPage, request, 'zh', normal.email!);
  const download = await ownerPage.request.get(exportUrl);
  expect(download.ok()).toBe(true);
  expect(await download.text()).toContain('PrivateOnlyTown');
  expect(download.headers()['cache-control']).toContain('no-store');
  expect((await ownerPage.request.get(exportUrl)).status()).toBe(404);
  await ownerPage.goto('/zh/bazi/new');
  await fillBirth(ownerPage, 'zh');
  await ownerPage
    .getByRole('button', { name: copies.zh['form.birth.submit'], exact: true })
    .click();
  await expect(ownerPage).toHaveURL(/\/bazi\/r\/[^/]+$/);
  const newest = await db.reading.findFirstOrThrow({
    where: { userId: normal.id },
    orderBy: { createdAt: 'desc' },
  });
  expect(newest.knowledgeVersion).toBe(release.version);
  await ownerPage.goto(`/en/bazi/r/${old.id}`);
  // DESIGN-GAP: Assert the visible main report after streamed sections replace the loading segment, then require a unique layout before verifying immutable translation versions.
  await expect(ownerPage.locator('#main .report-layout')).toBeVisible();
  await expect(ownerPage.locator('#main .report-layout .report-section')).not.toHaveCount(0);
  await expect(ownerPage.locator('.report-layout')).toHaveCount(1);
  const translatedOld = await db.reading.findUniqueOrThrow({ where: { id: old.id } });
  expect((translatedOld.reportEn as { knowledgeVersion: string }).knowledgeVersion).toBe(
    old.knowledgeVersion,
  );
  await ownerContext.close();
  await page.reload();
  await page.getByLabel(copies.zh['admin.release.rollback']).selectOption(old.knowledgeVersion);
  await page
    .getByLabel(copies.zh['admin.release.notes'])
    .fill('M5 rollback republishes an immutable snapshot');
  await page
    .getByRole('button', { name: copies.zh['admin.release.preflight'], exact: true })
    .click();
  await expect(page.getByText(copies.zh['admin.release.ready'], { exact: true })).toBeVisible({
    timeout: 90000,
  });
  await page.getByRole('button', { name: copies.zh['admin.release.publish'], exact: true }).click();
  await expect(page.getByRole('status')).toContainText('knowledgeVersion');
  expect(await db.knowledgeRelease.count()).toBe(3);
  const restored = await db.knowledgeRelease.findFirstOrThrow({
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
  });
  const restoredBundle = JSON.parse(
    (await cache.get(`knowledge:${restored.version}:bazi:zh`))!,
  ) as { units: KnowledgeUnit[] };
  expect(restoredBundle.units.find((unit) => unit.id === unitId)?.zh.title).toBe(originalTitle);
  await page.goto('/admin/config');
  await audit(page);
  await page
    .getByLabel(
      copies.zh['admin.config.announcement'].replace('{locale}', copies.zh['me.language.zh']),
    )
    .fill('M5 公告');
  await page
    .getByLabel(
      copies.zh['admin.config.announcement'].replace('{locale}', copies.zh['me.language.en']),
    )
    .fill('M5 announcement');
  await page.getByRole('button', { name: copies.zh['admin.config.save'], exact: true }).click();
  await expect(page.getByRole('status')).toHaveText(copies.zh['admin.saved']);
  await page.goto('/zh');
  await expect(page.getByText('M5 公告', { exact: true })).toBeVisible();
  await page.goto('/en');
  await expect(page.getByText('M5 announcement', { exact: true })).toBeVisible();
  await page.goto('/admin/config');
  await page.getByLabel(copies.zh['admin.config.maintenance'], { exact: true }).check();
  await page.getByRole('button', { name: copies.zh['admin.config.save'], exact: true }).click();
  await expect(page.getByRole('status')).toHaveText(copies.zh['admin.saved']);
  await page.goto('/zh');
  await expect(
    page.getByRole('heading', { name: copies.zh['site.maintenance.title'], exact: true }),
  ).toBeVisible();
  await page.goto('/zh/auth/login');
  await expect(
    page.getByRole('heading', { name: copies.zh['site.maintenance.title'], exact: true }),
  ).toHaveCount(0);
  await page.goto('/admin/config');
  await page.getByLabel(copies.zh['admin.config.maintenance'], { exact: true }).uncheck();
  await page.getByRole('button', { name: copies.zh['admin.config.save'], exact: true }).click();
  await expect(page.getByRole('status')).toHaveText(copies.zh['admin.saved']);
  const feedback = await db.feedback.create({
    data: { unitId, text: 'Private feedback', vote: 1 },
  });
  await db.feedback.create({
    data: {
      text: 'Old private feedback',
      vote: -1,
      createdAt: new Date(Date.now() - 31 * 86400000),
    },
  });
  await page.goto('/admin/feedback');
  await audit(page);
  await page
    .getByRole('button', { name: copies.zh['admin.feedback.deleteText'], exact: true })
    .first()
    .click();
  await expect(page.getByRole('status')).toBeVisible();
  expect((await db.feedback.findUniqueOrThrow({ where: { id: feedback.id } })).text).toBeNull();
  await page.goto(`/admin/users/${normal.id}`);
  await page.getByRole('button', { name: copies.zh['admin.users.delete'], exact: true }).click();
  await expect
    .poll(async () =>
      Boolean((await db.user.findUniqueOrThrow({ where: { id: normal.id } })).deletedAt),
    )
    .toBe(true);
  expect(await db.session.count({ where: { userId: normal.id } })).toBe(0);
  await page.goto('/admin/audit');
  await audit(page);
  const audits = await db.adminAuditLog.findMany({ where: { adminId: admin.id } });
  for (const action of [
    'user.plan',
    'user.export_email',
    'user.soft_delete',
    'ku.draft',
    'ku.publish',
    'ku.rollback',
    'config.update',
    'feedback.delete_text',
  ])
    expect(audits.some((a) => a.action === action)).toBe(true);
  expect(JSON.stringify(audits)).not.toContain('Private feedback');
  const yesterday = new Date(new Date().toISOString().slice(0, 10));
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  const name = `test.${randomUUID()}`;
  await db.event.createMany({
    data: [
      { day: yesterday, name, userHash: 'same' },
      { day: yesterday, name, userHash: 'same' },
      { day: yesterday, name, userHash: 'other' },
    ],
  });
  expect((await request.get('/api/v1/cron/daily-maintenance')).status()).toBe(401);
  for (let i = 0; i < 2; i++)
    expect(
      (
        await request.get('/api/v1/cron/daily-maintenance', {
          headers: { Authorization: 'Bearer isolated-cron-secret' },
        })
      ).ok(),
    ).toBe(true);
  const aggregate = await db.eventDaily.findFirstOrThrow({ where: { name } });
  expect(aggregate.count).toBe(3);
  expect(aggregate.uniques).toBe(2);
  expect(await db.eventDaily.count({ where: { name } })).toBe(1);
  expect(
    await db.eventDaily.count({
      where: { day: { gte: new Date(new Date().toISOString().slice(0, 10)) } },
    }),
  ).toBe(0);
  await db.event.create({ data: { day: yesterday, name, userHash: 'same' } });
  const repeated = await request.get('/api/v1/cron/daily-maintenance', {
    headers: { Authorization: 'Bearer isolated-cron-secret' },
  });
  expect(repeated.ok()).toBe(true);
  const corrected = await db.eventDaily.findFirstOrThrow({ where: { name } });
  expect(corrected.count).toBe(4);
  expect(corrected.uniques).toBe(2);
  expect(await db.feedback.count({ where: { text: 'Old private feedback' } })).toBe(0);
  await page.goto('/admin');
  await page.getByLabel(copies.zh['me.language'], { exact: true }).selectOption('en');
  await page.getByRole('button', { name: copies.zh['admin.apply'], exact: true }).first().click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(
    page.getByRole('heading', { name: copies.en['admin.nav.dashboard'], exact: true }),
  ).toBeVisible();
  await audit(page);
  for (const route of [
    '/admin/users',
    `/admin/users/${normal.id}`,
    '/admin/knowledge',
    `/admin/knowledge/${unitId}`,
    '/admin/knowledge/releases',
    '/admin/config',
    '/admin/feedback',
    '/admin/audit',
  ]) {
    await page.goto(route);
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await audit(page);
    await page.keyboard.press('Tab');
    await expect(page.locator('a.skip-link')).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.locator('main')).toBeFocused();
  }
});
