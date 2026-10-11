import { TestCache } from '../../../scripts/test-cache';
import { testDatabaseUrl } from '../../../scripts/sqlite-test';
import { test, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import jsQR from 'jsqr';
import { sizePoster, limitPosterHeight, printSettled } from '../lib/platform/print-dom';
import { randomUUID } from 'node:crypto';
import { login, db } from './m5-helpers';
import sharp from 'sharp';
import { systems, seedExportReading } from './export-fixtures';
const output = 'test-results/export';
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
      // DESIGN-GAP: Match the renderer's combined single-copy/ready contract; a second streamed copy can appear after the initial shell.
      await expect.poll(() => page.evaluate(printSettled), { timeout: 60000 }).toBe(true);
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
      const { chartWidth: pdfChartWidth, ...introduction } = await page
        .locator('.print-pages .print-intro')
        .evaluate((node) => ({
          titleFont: getComputedStyle(node.querySelector('h1')!).fontFamily,
          titleSize: getComputedStyle(node.querySelector('h1')!).fontSize,
          personaFont: getComputedStyle(node.querySelector('.print-persona')!).fontFamily,
          chartWidth: getComputedStyle(node.querySelector('.print-chart svg')!).width,
        }));
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
          bodyPixels?: number;
          marginPixels?: number;
          scale?: number;
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
        expect(done.url).not.toContain('width=');
        const file = await page.request.get(done.url!);
        expect(file.ok()).toBe(true);
        const data = await file.body();
        expect(data.length).toBeLessThanOrEqual(format === 'pdf' ? 2000000 : 6000000);
        const path = join(output, done.filename!);
        await writeFile(path, data);
        artifact[format] = { size: data.length, pages: sheetCount };
        if (format === 'pdf') {
          const info = execFileSync('pdfinfo', [path], { encoding: 'utf8' });
          expect(Number(/Pages:\s+(\d+)/.exec(info)?.[1])).toBe(sheetCount);
          const a4 = /Page size:\s+([\d.]+) x ([\d.]+) pts/.exec(info);
          expect(Math.abs(Number(a4?.[1]) - (210 * 72) / 25.4)).toBeLessThan(1);
          expect(Math.abs(Number(a4?.[2]) - (297 * 72) / 25.4)).toBeLessThan(1);
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
          expect(metadata.width).toBe(1654);
          expect(metadata.height).toBeLessThanOrEqual(16000);
          expect(metadata.height).toBeGreaterThan(metadata.width!);
          await page.goto(`/${locale}/${system}/r/${reading.id}/print?layout=poster`);
          await expect.poll(() => page.evaluate(printSettled)).toBe(true);
          await expect(page.locator('.print-report')).toHaveAttribute('data-ready', 'true');
          const { chartWidth: posterChartWidth, ...posterIntroduction } = await page
            .locator('.print-source .print-intro')
            .evaluate((node) => ({
              titleFont: getComputedStyle(node.querySelector('h1')!).fontFamily,
              titleSize: getComputedStyle(node.querySelector('h1')!).fontSize,
              personaFont: getComputedStyle(node.querySelector('.print-persona')!).fontFamily,
              chartWidth: getComputedStyle(node.querySelector('.print-chart svg')!).width,
            }));
          expect(posterIntroduction).toEqual(introduction);
          expect(Math.abs(parseFloat(posterChartWidth) - parseFloat(pdfChartWidth))).toBeLessThan(
            0.1,
          );
          await page.setViewportSize({ width: metadata.width!, height: 1200 });
          const height = await page.evaluate(sizePoster);
          if (height > 16000) await page.evaluate(limitPosterHeight, 16000);
          const type = await page.locator('.print-report').evaluate((node) => {
            const styles = getComputedStyle(node);
            const zoom = parseFloat(styles.zoom);
            return {
              bodyPixels: parseFloat(styles.fontSize) * zoom,
              marginPixels: parseFloat(styles.paddingLeft) * zoom,
              scale: Number((node as HTMLElement).dataset.posterScale),
            };
          });
          expect(type.bodyPixels).toBeGreaterThanOrEqual(25 - 0.01);
          expect(type.marginPixels).toBeCloseTo(((12 * 200) / 25.4) * type.scale, 0);
          const frame = await page.locator('.print-report').boundingBox();
          expect(Math.abs(frame!.width - metadata.width! * type.scale)).toBeLessThanOrEqual(1);
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
                section: section.dataset.printSection,
                inside:
                  box.left >= root.left && box.right <= root.right && box.bottom <= root.bottom,
                height: box.height,
                gap: previous ? box.top - previous.bottom : 0,
              };
            });
          });
          // The introduction adds 3mm padding and a 0.2mm rule before the body's 2mm margin.
          const maximumGap = ((5.2 * 200) / 25.4) * type.scale + 1;
          expect(
            geometry.filter(
              (section) => !section.inside || section.height <= 0 || section.gap > maximumGap,
            ),
          ).toEqual([]);
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
            ...type,
          };
        }
      }
      await writeFile(
        join(output, `${system}-${locale}-checks.json`),
        JSON.stringify({ layout, sheetCount, artifact }, null, 2),
      );
      // Light edition uses the same measured geometry and is rendered as a separate preview baseline.
      await page.goto(`/${locale}/${system}/r/${reading.id}/print?theme=light`);
      await expect.poll(() => page.evaluate(printSettled)).toBe(true);
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
