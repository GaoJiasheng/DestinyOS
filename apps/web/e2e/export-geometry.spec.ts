import { test, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import sharp from 'sharp';
import { seedExportReading } from './export-fixtures';
import { login } from './m5-helpers';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import jsQR from 'jsqr';
import { sizePoster, limitPosterHeight, printSettled } from '../lib/platform/print-dom';
const output = 'test-results/export';
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('tianji-disclaimer-v1', 'accepted'));
});
for (const theme of ['dark', 'light'] as const)
  test(`${theme}: an empty shell host cannot prepend a blank PDF page`, async ({ page }) => {
    const css = await readFile(
      new URL('../app/[locale]/[system]/r/[id]/print/print.css', import.meta.url),
      'utf8',
    );
    await page.emulateMedia({ media: 'print' });
    // Reproduce a hydrated notification host that has no text or height before named report sheets.
    await page.setContent(`
      <style>${css}</style>
      <section aria-label="Notifications" tabindex="-1"></section>
      <main id="main">
        <div class="print-report" data-print-theme="${theme}" data-layout="pdf">
          <div class="print-pages">
            <section class="print-sheet">First</section>
            <section class="print-sheet">Second</section>
          </div>
        </div>
      </main>
    `);
    await mkdir(output, { recursive: true });
    const path = join(output, `no-blank-host-${theme}.pdf`);
    await page.pdf({ path, format: 'A4', printBackground: true, preferCSSPageSize: true });
    const info = execFileSync('pdfinfo', [path], { encoding: 'utf8' });
    expect(Number(/Pages:\s+(\d+)/.exec(info)?.[1])).toBe(2);
    const text = execFileSync('pdftotext', [path, '-'], { encoding: 'utf8' });
    expect(text.split('\f')[0]).toContain('First');
    expect(text.split('\f')[1]).toContain('Second');
  });
test('height limiting preserves A4 line breaks, the body floor and scannable QR pixels', async ({
  page,
  request,
}) => {
  const user = await login(page, request, 'zh', `export-scale-${randomUUID()}@example.test`);
  const reading = await seedExportReading(user.id, 'bazi', 'zh');
  await page.setViewportSize({ width: 1654, height: 1200 });
  await page.goto(`/zh/bazi/r/${reading.id}/print?layout=poster`);
  // DESIGN-GAP: Match the renderer's combined single-copy/ready contract; a second streamed copy can appear after the initial shell.
  await expect.poll(() => page.evaluate(printSettled)).toBe(true);
  await expect(page.locator('.print-report')).toHaveAttribute('data-ready', 'true');
  await page.evaluate(sizePoster);
  const before = await page.locator('.print-report').evaluate((node) => {
    const root = node as HTMLElement;
    const zoom = parseFloat(getComputedStyle(root).zoom);
    const spacer = document.createElement('div');
    // Test-only padding creates a controlled 16400px sheet without adding or removing any report text.
    spacer.style.height = `${(16400 - root.getBoundingClientRect().height) / zoom}px`;
    const source = root.querySelector('.print-source')!;
    source.insertBefore(spacer, source.lastElementChild);
    const prose = root.querySelector<HTMLParagraphElement>('p[data-print-block]')!;
    return {
      width: root.style.width,
      text: source.textContent,
      proseWidth: prose.getBoundingClientRect().width,
      proseHeight: prose.getBoundingClientRect().height,
    };
  });
  expect(await page.evaluate(limitPosterHeight, 16000)).toBeLessThanOrEqual(16000);
  const after = await page.locator('.print-report').evaluate((node) => {
    const root = node as HTMLElement;
    const styles = getComputedStyle(root);
    const prose = root.querySelector<HTMLParagraphElement>('p[data-print-block]')!;
    const qr = root.querySelector('.print-end-qr img')!.getBoundingClientRect();
    return {
      width: root.style.width,
      text: root.querySelector('.print-source')!.textContent,
      proseWidth: prose.getBoundingClientRect().width,
      proseHeight: prose.getBoundingClientRect().height,
      scale: Number(root.dataset.posterScale),
      bodyPixels: parseFloat(styles.fontSize) * parseFloat(styles.zoom),
      qrWidth: qr.width,
    };
  });
  expect(after.width).toBe(before.width);
  expect(after.text).toBe(before.text);
  expect(after.bodyPixels).toBeGreaterThanOrEqual(25);
  expect(after.scale).toBeLessThan(1);
  expect(after.proseWidth / before.proseWidth).toBeCloseTo(after.scale, 3);
  expect(after.proseHeight / before.proseHeight).toBeCloseTo(after.scale, 3);
  expect(after.qrWidth).toBeCloseTo(180, 0);
  const data = await page.screenshot({ type: 'jpeg', quality: 70, fullPage: true, scale: 'css' });
  const metadata = await sharp(data).metadata();
  expect(metadata.width).toBe(1654);
  expect(metadata.height).toBeLessThanOrEqual(16000);
  await mkdir(output, { recursive: true });
  await writeFile(join(output, 'a4-height-limit-zh.jpg'), data);
  const pixels = await sharp(data)
    .extract({ left: 0, top: metadata.height! - 2000, width: 1654, height: 2000 })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  expect(
    jsQR(new Uint8ClampedArray(pixels.data), pixels.info.width, pixels.info.height)?.data,
  ).toBe('https://tianji.gavin.pub/zh');
});
test('zh tarot Fixture A paginates only after the print font sheets apply', async ({
  page,
  request,
  browser,
  baseURL,
}) => {
  // Regression: the in-body font links were re-inserted by the client and the print effect could run
  // before their @font-face rules existed; this fixture's third column then overflowed by ~13px once
  // the real fonts swapped in, failing roughly half of renderer exports with E_INTERNAL.
  const user = await login(page, request, 'zh', `export-fonts-${randomUUID()}@example.test`);
  const reading = await seedExportReading(user.id, 'tarot', 'zh');
  const storageState = await page.context().storageState();
  for (let run = 0; run < 6; run++) {
    // Mirror the renderer: a fresh A4 print context whose routed requests bypass the HTTP cache.
    const context = await browser.newContext({
      viewport: { width: 794, height: 1123 },
      deviceScaleFactor: 1,
      reducedMotion: 'reduce',
      serviceWorkers: 'block',
      baseURL,
      storageState,
    });
    await context.route('**/*', (route) => route.continue());
    await context.addInitScript(() => {
      const record = window as unknown as { __printFontSheets?: string[] };
      const load = document.fonts.load.bind(document.fonts);
      document.fonts.load = (font, text) => {
        record.__printFontSheets ??= Array.from(document.styleSheets)
          .map((sheet) => sheet.href?.split('/').pop() ?? '')
          .filter((name) => name.startsWith('fonts-'));
        return load(font, text);
      };
    });
    const print = await context.newPage();
    await print.emulateMedia({ media: 'print' });
    await print.goto(`/zh/tarot/r/${reading.id}/print?theme=dark&layout=pdf`);
    await expect.poll(() => print.evaluate(printSettled), { timeout: 60000 }).toBe(true);
    await expect(print.locator('.print-report')).toHaveAttribute('data-ready', 'true');
    const sheets = await print.evaluate(
      () => (window as unknown as { __printFontSheets?: string[] }).__printFontSheets,
    );
    expect(sheets?.sort()).toEqual([
      'fonts-body.css',
      'fonts-print-symbols.css',
      'fonts-print.css',
    ]);
    const overflow = await print
      .locator('.print-column')
      .evaluateAll((nodes) => nodes.map((n) => n.scrollHeight - n.clientHeight));
    expect(overflow.every((value) => value <= 1)).toBe(true);
    await context.close();
  }
});
