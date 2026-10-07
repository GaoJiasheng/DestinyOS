import { test, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import sharp from 'sharp';
import { seedExportReading } from './export-fixtures';
import { testDatabaseUrl } from '../../../scripts/sqlite-test';
import { login, seedReading, db, copies } from './m5-helpers';
import { TestCache } from '../../../scripts/test-cache';
import { execFileSync } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
const output = 'test-results/export';
test.beforeEach(async ({ page }) => {
  await mkdir(output, { recursive: true });
  await page.addInitScript(() => localStorage.setItem('tianji-disclaimer-v1', 'accepted'));
});
test('owner, membership, cache and quota enforcement', async ({ page, request }) => {
  const user = await login(page, request, 'en', `export-security-${randomUUID()}@example.test`);
  const reading = await seedReading(user.id, 'bazi', 'en');
  const input = { readingId: reading.id, locale: 'en', format: 'cover', theme: 'light' };
  await db.siteConfig.upsert({
    where: { key: 'export.freeEnabled' },
    create: { key: 'export.freeEnabled', value: false, updatedBy: user.id },
    update: { value: false },
  });
  const redis = new TestCache(testDatabaseUrl(57552));
  await redis.del('site-config');
  expect((await page.request.post('/api/export', { data: input })).status()).toBe(403);
  await db.user.update({ where: { id: user.id }, data: { plan: 'pro' } });
  const response = await page.request.post('/api/export', { data: input, timeout: 240000 });
  const done = JSON.parse((await response.text()).trim().split('\n').at(-1)!) as {
    url: string;
    progress: number;
  };
  expect(done.progress).toBe(100);
  expect((await page.request.get(done.url)).status()).toBe(200);
  const cached = await page.request.post('/api/export', { data: input });
  expect(await cached.text()).toContain('"progress":95');
  await db.user.update({ where: { id: user.id }, data: { plan: 'free' } });
  expect((await page.request.get(done.url)).status()).toBe(403);
  await db.siteConfig.update({ where: { key: 'export.freeEnabled' }, data: { value: true } });
  await redis.del('site-config');
  for (let i = 0; i < 12; i++)
    expect((await page.request.post('/api/export', { data: input })).ok()).toBe(true);
  const { ratelimit } = await import('../lib/ratelimit');
  for (let i = 0; i < 9; i++) await ratelimit('export', user.id);
  expect(
    (await page.request.post('/api/export', { data: { ...input, format: 'pdf' } })).status(),
  ).toBe(429);
  expect((await page.request.post('/api/export', { data: input })).ok()).toBe(true);
  await login(page, request, 'en', `export-other-${randomUUID()}@example.test`);
  expect((await page.request.get(done.url)).status()).toBe(404);
  const anonymous = await request.get(done.url);
  expect(anonymous.status()).toBe(401);
});
for (const locale of ['zh', 'en'] as const)
  test(`${locale}: export menu streams progress and downloads the light vector PDF`, async ({
    page,
    request,
  }) => {
    const user = await login(
      page,
      request,
      locale,
      `export-menu-${locale}-${randomUUID()}@example.test`,
    );
    const reading = await seedExportReading(user.id, 'bazi', locale);
    const copy = copies[locale];
    await page.goto(`/${locale}/bazi/r/${reading.id}`);
    const menu = page.locator('#main .export-menu');
    await menu.getByRole('button', { name: copy['export.menu'], exact: true }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByLabel(copy['export.theme'])).toHaveValue('dark');
    await dialog.getByLabel(copy['export.theme']).selectOption('light');
    const downloadPromise = page.waitForEvent('download', { timeout: 65000 });
    await dialog.getByRole('button', { name: copy['export.pdf'], exact: true }).click();
    await expect(dialog.locator('progress')).toHaveAttribute('value', '100', { timeout: 120000 });
    const download = await downloadPromise;
    const path = join(output, `bazi-${locale}-light.pdf`);
    await download.saveAs(path);
    const info = execFileSync('pdfinfo', [path], { encoding: 'utf8' });
    expect(Number(/Pages:\s+(\d+)/.exec(info)?.[1])).toBeLessThanOrEqual(6);
    const text = execFileSync('pdftotext', ['-layout', path, '-'], { encoding: 'utf8' });
    expect(text).toContain(locale === 'zh' ? '免责声明' : 'Disclaimer');
  });
test('mobile drawer retries a timeout, downloads one A4 JPEG and shares the cover', async ({
  page,
  request,
}) => {
  await page.setViewportSize({ width: 375, height: 812 });
  const user = await login(page, request, 'en', `export-mobile-${randomUUID()}@example.test`);
  const reading = await seedExportReading(user.id, 'bazi', 'en');
  const copy = copies.en;
  await page.goto(`/en/bazi/r/${reading.id}`);
  await page.locator('.export-menu').getByRole('button').click();
  const dialog = page.getByRole('dialog');
  const box = await dialog.boundingBox();
  expect(Math.round(box!.y + box!.height)).toBe(812);
  await expect(dialog.locator('select')).toHaveCount(1);
  await page.route('**/api/export', (route) =>
    route.fulfill({ contentType: 'application/x-ndjson', body: '{"error":"E_EXPORT_TIMEOUT"}\n' }),
  );
  await dialog.getByRole('button', { name: copy['export.png'], exact: true }).click();
  await expect(dialog.getByRole('alert')).toContainText(copy['export.timeout']);
  await page.unroute('**/api/export');
  const downloadPromise = page.waitForEvent('download', { timeout: 65000 });
  await dialog.getByRole('button', { name: copy['export.retry'], exact: true }).click();
  const download = await downloadPromise;
  const path = join(output, 'bazi-en-a4.jpg');
  await download.saveAs(path);
  const metadata = await sharp(path).metadata();
  expect(metadata.width).toBe(1654);
  expect(metadata.height).toBeLessThanOrEqual(16000);
  expect(await dialog.locator('ol').count()).toBe(0);
  await page.evaluate(() => {
    Object.defineProperty(navigator, 'canShare', { configurable: true, value: () => true });
    Object.defineProperty(navigator, 'share', {
      configurable: true,
      value: async (data: ShareData) => {
        document.documentElement.dataset.sharedCover = data.files?.[0]?.name;
      },
    });
  });
  await dialog.getByRole('button', { name: copy['export.cover'], exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-shared-cover', /-cover\.jpg$/, {
    timeout: 65000,
  });
  await expect(dialog).toContainText(copy['export.complete']);
});
