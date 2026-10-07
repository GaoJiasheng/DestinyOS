import { testDatabaseUrl } from '../../../scripts/sqlite-test';
import { TestCache } from '../../../scripts/test-cache';
import { test, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import jsQR from 'jsqr';
import { sizePoster, limitPosterHeight } from '../lib/platform/print-dom';
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
  test(`${locale}: Fixture A eight-system compact PDF and single JPEG acceptance`, async ({
    page,
    request,
  }) => {
    // Sixteen render jobs each retain their own enforced 60s deadline; allow the full bilingual-fixture loop to finish.
    test.setTimeout(1100000);
    const user = await login(
      page,
      request,
      locale,
      `export-${locale}-${randomUUID()}@example.test`,
    );
    await mkdir(output, { recursive: true });
    // Test-fixture entitlement allows eight pairs while production quotas remain ten per hour per account.
    for (const system of systems) {
      await page.setViewportSize({ width: 1000, height: 1200 });
      const reading = await seedExportReading(user.id, system, locale);
      const source = await db.reading.findUniqueOrThrow({ where: { id: reading.id } });
      await page.goto(`/${locale}/${system}/r/${reading.id}/print`);
      await expect(page.locator('.print-report')).toHaveAttribute('data-ready', 'true', {
        timeout: 60000,
      });
      const sheetCount = await page.locator('.print-sheet').count();
      const ink = await page
        .locator('.print-report')
        .evaluate((node) => getComputedStyle(node).color);
      expect(ink).toBe('rgb(243, 241, 234)');
      expect(sheetCount).toBeLessThanOrEqual(['iching', 'qimen', 'tarot'].includes(system) ? 3 : 6);
      await expect(page.locator('.print-pages .print-keywords span')).toHaveCount(3);
      const layout = await page.locator('.print-column').evaluateAll((nodes) =>
        nodes.map((n) => ({
          overflow: n.scrollHeight - n.clientHeight,
          text: n.textContent?.trim().length ?? 0,
        })),
      );
      expect(layout.every((p) => p.overflow <= 1)).toBe(true);
      expect(layout.slice(0, -1).every((p) => p.text > 0)).toBe(true);
      await expect(
        page.locator('.print-sheet').first().locator('[data-print-section="cover"]'),
      ).toHaveCount(1);
      await expect(
        page.locator('.print-sheet').first().locator('[data-print-section="chart"]'),
      ).toHaveCount(1);
      await expect(page.locator('.print-footer').last()).toContainText(
        `${sheetCount} / ${sheetCount}`,
      );
      const sourceReport = source[locale === 'zh' ? 'reportZh' : 'reportEn'] as {
        sections: { title: string; blocks: { type: string; text?: string }[] }[];
      };
      // Read columns in flow order without inserting repeated page headers/footers into split paragraphs.
      const visible = (await page.locator('.print-column').allTextContents()).join('');
      const sourceProse = await page.locator('.print-source p[data-print-block]').allTextContents();
      const normalized = (text: string) => text.replace(/[\s\u00ad]/g, '');
      for (const prose of sourceProse) expect(normalized(visible)).toContain(normalized(prose));
      for (const section of sourceReport.sections) expect(visible).toContain(section.title);
      expect(visible).not.toContain('1990-5-15');
      expect(visible).not.toContain('08:30');
      const artifact: Record<
        string,
        {
          size: number;
          pages: number;
          width?: number;
          height?: number;
          qr?: string;
          searchable?: boolean;
        }
      > = {};
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
        expect(data.length).toBeLessThanOrEqual(format === 'pdf' ? 2000000 : 3000000);
        const path = join(output, done.filename!);
        await writeFile(path, data);
        artifact[format] = { size: data.length, pages: sheetCount };
        if (format === 'pdf') {
          const info = execFileSync('pdfinfo', [path], { encoding: 'utf8' });
          expect(Number(/Pages:\s+(\d+)/.exec(info)?.[1])).toBe(sheetCount);
          // Raw content-stream order preserves the two columns; crop only the repeating header/footer areas (points at 72dpi).
          const text = execFileSync(
            'pdftotext',
            ['-raw', '-x', '28', '-y', '53', '-W', '539', '-H', '735', path, '-'],
            { encoding: 'utf8' },
          );
          expect(text).toContain(locale === 'zh' ? '免责声明' : 'Disclaimer');
          for (const section of sourceReport.sections)
            expect(text.replace(/\s/g, '')).toContain(section.title.replace(/\s/g, ''));
          for (const prose of sourceProse) expect(normalized(text)).toContain(normalized(prose));
          expect(text).not.toContain('1990-05-15');
          artifact[format]!.searchable = true;
          const fonts = execFileSync('pdffonts', [path], { encoding: 'utf8' });
          expect(fonts).toContain('Tianji-Noto');
          expect(fonts).not.toContain('STSongti');
          expect(fonts).not.toMatch(/PingFang|ArialUnicode|STIXTwo/);
          const fontRows = fonts.trim().split('\n').slice(2);
          expect(fontRows.every((row) => /yes\s+yes\s+yes/.test(row))).toBe(true);
          execFileSync('pdftoppm', [
            '-scale-to',
            '1000',
            '-png',
            path,
            join(output, `${system}-${locale}-pdf`),
          ]);
        } else {
          expect(done.files).toBeUndefined();
          const metadata = await sharp(data).metadata();
          expect(metadata.format).toBe('jpeg');
          expect([1242, 1600]).toContain(metadata.width);
          expect(metadata.height).toBeLessThanOrEqual(16000);
          expect(metadata.height).toBeGreaterThan(metadata.width!);
          await page.goto(
            `/${locale}/${system}/r/${reading.id}/print?layout=poster&width=${metadata.width}`,
          );
          await expect(page.locator('.print-report')).toHaveAttribute('data-ready', 'true');
          await page.setViewportSize({ width: metadata.width!, height: 1200 });
          const height = await page.evaluate(sizePoster, metadata.width!);
          if (height > 16000) await page.evaluate(limitPosterHeight, 16000);
          const frame = await page.locator('.print-report').boundingBox();
          expect(Math.abs(frame!.width - metadata.width!)).toBeLessThanOrEqual(1);
          expect(Math.abs(frame!.height - metadata.height!)).toBeLessThanOrEqual(2);
          const posterText = await page.locator('.print-source').innerText();
          for (const prose of sourceProse)
            expect(normalized(posterText)).toContain(normalized(prose));
          const geometry = await page.locator('.print-source').evaluate((node) => {
            const root = node.closest('.print-report')!.getBoundingClientRect();
            const sections = Array.from(node.querySelectorAll<HTMLElement>('[data-print-section]'));
            return sections.map((section, i) => {
              const box = section.getBoundingClientRect();
              const previous = sections[i - 1]?.getBoundingClientRect();
              return {
                inside:
                  box.left >= root.left && box.right <= root.right && box.bottom <= root.bottom,
                height: box.height,
                gap: previous ? box.top - previous.bottom : 0,
              };
            });
          });
          expect(
            geometry.every((section) => section.inside && section.height > 0 && section.gap <= 40),
          ).toBe(true);
          // Decode pixels from the downloaded artifact, independent of a second browser's font/layout timing.
          const scanHeight = Math.min(metadata.height!, 4000);
          const pixels = await sharp(data)
            .extract({
              left: 0,
              top: metadata.height! - scanHeight,
              width: metadata.width!,
              height: scanHeight,
            })
            .resize({ width: 1000, withoutEnlargement: true })
            .ensureAlpha()
            .raw()
            .toBuffer({ resolveWithObject: true });
          const decoded = jsQR(
            new Uint8ClampedArray(pixels.data),
            pixels.info.width,
            pixels.info.height,
          );
          expect(decoded?.data).toBe(`https://tianji.gavin.pub/${locale}`);
          artifact[format] = {
            size: data.length,
            pages: 1,
            width: metadata.width,
            height: metadata.height,
            qr: decoded?.data,
          };
        }
      }
      await writeFile(
        join(output, `${system}-${locale}-checks.json`),
        JSON.stringify({ layout, sheetCount, artifact }, null, 2),
      );
      // Light edition uses the same measured geometry and is rendered as a separate preview baseline.
      await page.goto(`/${locale}/${system}/r/${reading.id}/print?theme=light`);
      await expect(page.locator('.print-report')).toHaveAttribute('data-ready', 'true');
      expect(
        await page.locator('.print-report').evaluate((node) => getComputedStyle(node).color),
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
    const downloadPromise = page.waitForEvent('download');
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
test('mobile drawer retries a timeout, downloads one wide JPEG and shares the cover', async ({
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
  await dialog.getByLabel(copy['export.width']).selectOption('1600');
  await page.route('**/api/export', (route) =>
    route.fulfill({ contentType: 'application/x-ndjson', body: '{"error":"E_EXPORT_TIMEOUT"}\n' }),
  );
  await dialog.getByRole('button', { name: copy['export.png'], exact: true }).click();
  await expect(dialog.getByRole('alert')).toContainText(copy['export.timeout']);
  await page.unroute('**/api/export');
  const downloadPromise = page.waitForEvent('download');
  await dialog.getByRole('button', { name: copy['export.retry'], exact: true }).click();
  const download = await downloadPromise;
  const path = join(output, 'bazi-en-wide.jpg');
  await download.saveAs(path);
  const metadata = await sharp(path).metadata();
  expect(metadata.width).toBe(1600);
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
