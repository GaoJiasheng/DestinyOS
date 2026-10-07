import { testDatabaseUrl } from '../../../scripts/sqlite-test';
import { TestCache } from '../../../scripts/test-cache';
import { test, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { unzipSync } from 'fflate';
import { randomUUID } from 'node:crypto';
import { login, seedReading, db, birth, copies } from './m5-helpers';
import { generateReading, json } from '../lib/reading-service';
import { encryptField } from '../lib/crypto';
import sharp from 'sharp';
const systems = [
  'bazi',
  'ziwei',
  'iching',
  'qimen',
  'tarot',
  'astrology',
  'vedic',
  'numerology',
] as const;
const output = 'test-results/export';
// Fixture A follows launch-check's documented fixed birth/clock, number cast and seeded Celtic Cross.
async function seedExportReading(
  userId: string,
  system: (typeof systems)[number],
  locale: 'zh' | 'en',
) {
  const now = '2026-10-04T00:00:00Z';
  const input = {
    system,
    locale,
    birth,
    idempotencyKey: randomUUID(),
    seed: 'fixture-A',
    ...(system === 'tarot' ? { spread: 'celtic_cross' as const } : {}),
    ...(system === 'iching'
      ? {
          method: 'meihua' as const,
          category: 'career',
          numbers: [1, 8, 1] as [number, number, number],
        }
      : {}),
    ...(system === 'qimen'
      ? {
          question: {
            at: `${now}[UTC]`,
            place: { lng: birth.place!.lng, tz: birth.place!.tz },
            category: 'general',
          },
        }
      : {}),
  };
  const result = await generateReading(input, now);
  return db.reading.create({
    data: {
      userId,
      system,
      encInput: encryptField(JSON.stringify(input), 'Reading.encInput', userId),
      chart: json(result.chart),
      reportZh: locale === 'zh' ? json(result.report) : undefined,
      reportEn: locale === 'en' ? json(result.report) : undefined,
      schoolUsed: json(result.meta.schoolUsed),
      engineVersion: result.report.engineVersion,
      interpretVersion: result.report.interpretVersion,
      knowledgeVersion: result.report.knowledgeVersion,
      createdAt: new Date(now),
    },
  });
}

process.env.LOCAL_DATABASE_URL = testDatabaseUrl(57552);

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('tianji-disclaimer-v1', 'accepted'));
});
for (const locale of ['zh', 'en'] as const)
  test(`${locale}: Fixture A eight-system PDF and 300dpi PNG acceptance`, async ({
    page,
    request,
  }) => {
    const user = await login(
      page,
      request,
      locale,
      `export-${locale}-${randomUUID()}@example.test`,
    );
    await mkdir(output, { recursive: true });
    // Test-fixture entitlement allows eight pairs while production quotas remain ten per hour per account.
    for (const system of systems) {
      const reading = await seedExportReading(user.id, system, locale);
      const source = await db.reading.findUniqueOrThrow({ where: { id: reading.id } });
      await page.goto(`/${locale}/${system}/r/${reading.id}/print`);
      await expect(page.locator('.print-report').filter({ visible: true })).toHaveAttribute(
        'data-ready',
        'true',
        {
          timeout: 60000,
        },
      );
      const sheetCount = await page.locator('.print-sheet').count();
      const ink = await page
        .locator('.print-report')
        .filter({ visible: true })
        .evaluate((node) => getComputedStyle(node).color);
      expect(ink).toBe('rgb(243, 241, 234)');
      expect(sheetCount).toBeGreaterThan(4);
      await expect(page.locator('.print-pages .print-keywords span')).toHaveCount(3);
      const layout = await page.locator('.print-page-content').evaluateAll((nodes) =>
        nodes.map((n) => ({
          overflow: n.scrollHeight - n.clientHeight,
          text: n.textContent?.trim().length ?? 0,
        })),
      );
      expect(layout.every((p) => p.overflow <= 1 && p.text > 0)).toBe(true);
      await expect(page.locator('.print-footer').last()).toContainText(
        `${sheetCount} / ${sheetCount}`,
      );
      const sourceReport = source[locale === 'zh' ? 'reportZh' : 'reportEn'] as {
        sections: { title: string; blocks: { type: string; text?: string }[] }[];
      };
      const visible = await page.locator('.print-pages').innerText();
      const sourceProse = await page.locator('.print-source p[data-print-block]').allTextContents();
      const normalized = (text: string) => text.replace(/[\s\u00ad]/g, '');
      for (const prose of sourceProse) expect(normalized(visible)).toContain(normalized(prose));
      for (const section of sourceReport.sections) expect(visible).toContain(section.title);
      expect(visible).not.toContain('1990-5-15');
      expect(visible).not.toContain('08:30');
      const artifact: Record<string, { size: number; pages: number }> = {};
      for (const format of ['pdf', 'png'] as const) {
        // Reset test quota only: the API must still reserve a real D1 slot for each generated artifact.
        const redis = new TestCache(testDatabaseUrl(57552));
        const { rateLimitKey } = await import('../lib/ratelimit');
        await redis.del(rateLimitKey('export', user.id));
        const input = { readingId: reading.id, locale, theme: 'dark', format };
        const response = await page.request.post('/api/export', { data: input, timeout: 240000 });
        expect(response.ok()).toBe(true);
        const events = (await response.text())
          .trim()
          .split('\n')
          .map(
            (line) =>
              JSON.parse(line) as {
                progress?: number;
                url?: string;
                error?: string;
                filename?: string;
                files?: { url: string; filename: string }[];
              },
          );
        const done = events.at(-1)!;
        expect(done.error).toBeUndefined();
        expect(done.progress).toBe(100);
        expect(done.url).toBeTruthy();
        const file = await page.request.get(done.url!);
        expect(file.ok()).toBe(true);
        const data = await file.body();
        expect(data.length).toBeLessThanOrEqual(8 * 1024 * 1024);
        const path = join(output, done.filename!);
        await writeFile(path, data);
        artifact[format] = { size: data.length, pages: sheetCount };
        if (format === 'pdf') {
          const info = execFileSync('pdfinfo', [path], { encoding: 'utf8' });
          expect(Number(/Pages:\s+(\d+)/.exec(info)?.[1])).toBe(sheetCount);
          const text = execFileSync('pdftotext', ['-layout', path, '-'], { encoding: 'utf8' });
          expect(text).toContain(locale === 'zh' ? '免责声明' : 'Disclaimer');
          for (const section of sourceReport.sections)
            expect(text.replace(/\s/g, '')).toContain(section.title.replace(/\s/g, ''));
          for (const prose of sourceProse) expect(normalized(text)).toContain(normalized(prose));
          expect(text).not.toContain('1990-05-15');
          const fonts = execFileSync('pdffonts', [path], { encoding: 'utf8' });
          expect(fonts).toContain('Tianji-Noto');
          expect(fonts).not.toContain('STSongti');
          expect(fonts).not.toMatch(/PingFang|ArialUnicode|STIXTwo/);
          expect(fonts).toContain('yes');
        } else {
          const pngs: Record<string, Uint8Array> = done.files ? {} : unzipSync(data);
          if (done.files) {
            for (const part of done.files) {
              const download = await page.request.get(part.url);
              expect(download.ok()).toBe(true);
              const bytes = await download.body();
              expect(bytes.length).toBeLessThanOrEqual(8 * 1024 * 1024);
              pngs[part.filename] = bytes;
              artifact[format]!.size = Math.max(artifact[format]!.size, bytes.length);
            }
          }
          expect(Object.keys(pngs)).toHaveLength(sheetCount);
          for (const [name, png] of Object.entries(pngs)) {
            expect(new DataView(png.buffer, png.byteOffset, png.byteLength).getUint32(16)).toBe(
              2480,
            );
            expect(new DataView(png.buffer, png.byteOffset, png.byteLength).getUint32(20)).toBe(
              3508,
            );
            expect((await sharp(png).metadata()).density).toBe(300);
            // A hidden dialog backdrop must never dim/blur the renderer's fresh-browser PNG capture.
            expect((await sharp(png).stats()).channels.some((channel) => channel.max >= 180)).toBe(
              true,
            );
            await writeFile(join(output, name), png);
          }
        }
      }
      await writeFile(
        join(output, `${system}-${locale}-checks.json`),
        JSON.stringify({ layout, sheetCount, artifact }, null, 2),
      );
      // Light edition uses the same measured geometry and is rendered as a separate preview baseline.
      await page.goto(`/${locale}/${system}/r/${reading.id}/print?theme=light`);
      await expect(page.locator('.print-report').filter({ visible: true })).toHaveAttribute(
        'data-ready',
        'true',
      );
      expect(
        await page
          .locator('.print-report')
          .filter({ visible: true })
          .evaluate((node) => getComputedStyle(node).color),
      ).toBe('rgb(27, 29, 42)');
      await page
        .locator('.print-sheet')
        .first()
        .screenshot({ path: join(output, `${system}-${locale}-light-cover.png`) });
    }
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
  for (let i = 0; i < 8; i++)
    expect((await page.request.post('/api/export', { data: input })).ok()).toBe(true);
  expect((await page.request.post('/api/export', { data: input })).status()).toBe(429);
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
    await menu.locator('summary').click();
    await expect(menu.getByLabel(copy['export.theme'])).toHaveValue('dark');
    await menu.getByLabel(copy['export.theme']).selectOption('light');
    await menu.getByRole('button', { name: copy['export.pdf'], exact: true }).click();
    await expect(menu.locator('progress')).toHaveAttribute('value', '100', { timeout: 120000 });
    const link = menu.getByRole('link', { name: copy['export.download'], exact: true });
    const response = await page.request.get((await link.getAttribute('href'))!);
    expect(response.ok()).toBe(true);
    const path = join(output, `bazi-${locale}-light.pdf`);
    await writeFile(path, await response.body());
    const info = execFileSync('pdfinfo', [path], { encoding: 'utf8' });
    expect(Number(/Pages:\s+(\d+)/.exec(info)?.[1])).toBeGreaterThan(4);
    const text = execFileSync('pdftotext', ['-layout', path, '-'], { encoding: 'utf8' });
    expect(text).toContain(locale === 'zh' ? '免责声明' : 'Disclaimer');
  });
