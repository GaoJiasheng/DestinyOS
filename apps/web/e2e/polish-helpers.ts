import { expect, type Page, type TestInfo } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { BirthInputSchema } from '@tianji/shared';
import { audit, auditLocale, birth, db } from './m5-helpers';
import { generateReading, json } from '../lib/reading-service';
import { encryptField } from '../lib/crypto';

export const polishSystems = [
  'bazi',
  'ziwei',
  'iching',
  'qimen',
  'tarot',
  'astrology',
  'vedic',
] as const;
/** Capture a settled bilingual screen and audit its accessibility and language. */
export async function capture(page: Page, info: TestInfo, name: string, locale: 'zh' | 'en') {
  await expect(page.locator('html')).toHaveAttribute('data-fonts-settled', 'true');
  await page.evaluate(() => document.fonts.ready);
  await page.mouse.move(0, 0);
  const directory = `test-results/polish/${info.project.name}/${locale}`;
  await mkdir(directory, { recursive: true });
  const dialogOpen = name.endsWith('-dialog') || name.startsWith('export-');
  if (dialogOpen) await expect(page.getByRole('dialog')).toBeVisible();
  // DESIGN-GAP: Full-page evidence must visit lazy artwork before capture; this does not change production loading behavior.
  if (!dialogOpen && !name.startsWith('term-')) {
    for (const artwork of await page.locator('[data-art]').all()) {
      if (await artwork.isVisible()) await artwork.scrollIntoViewIfNeeded();
    }
    await page.evaluate(async () => {
      await Promise.all(
        Array.from(document.querySelectorAll<HTMLImageElement>('[data-art] img'))
          .filter((image) => image.currentSrc)
          .map((image) => image.decode().catch(() => undefined)),
      );
    });
  }
  // Reset page captures after auto-scrolled ritual controls; anchored overlays retain their viewport.
  if (!dialogOpen && !name.startsWith('term-'))
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  await page.screenshot({
    path: `${directory}/${name}.png`,
    fullPage: !dialogOpen,
    scale: 'css',
    animations: 'disabled',
  });
  const metrics = await page.evaluate(() => {
    const targets = Array.from(
      document.querySelectorAll<HTMLElement>('button, a, select, input, summary, [role="button"]'),
    )
      .filter(
        (el) =>
          !el.closest('[inert], [aria-hidden="true"]') &&
          el.getClientRects().length &&
          getComputedStyle(el).visibility !== 'hidden',
      )
      .map((el) => {
        const target = el.matches('input[type="checkbox"], input[type="radio"]')
          ? (el.closest('label') ?? el)
          : el;
        const r = target.getBoundingClientRect();
        return {
          tag: el.tagName,
          class: el.getAttribute('class'),
          label: el.getAttribute('aria-label') ?? el.textContent?.trim().slice(0, 70),
          width: Math.round(r.width),
          height: Math.round(r.height),
        };
      })
      .filter((r) => r.width < 44 || r.height < 44);
    return {
      width: innerWidth,
      scrollWidth: document.documentElement.scrollWidth,
      theme: document.documentElement.dataset.theme,
      loadedFonts: Array.from(document.fonts)
        .filter((font) => font.status === 'loaded')
        .map((font) => font.family),
      titleFont: getComputedStyle(document.querySelector('main h1, main h2') ?? document.body)
        .fontFamily,
      overlappingChapters: Array.from(document.querySelectorAll<HTMLElement>('.section-nav a'))
        .filter((link) => link.scrollWidth > link.clientWidth + 1)
        .map((link) => link.textContent),
      smallTargets: targets,
    };
  });
  await writeFile(`${directory}/${name}.json`, JSON.stringify(metrics, null, 2));
  if (name.startsWith('term-'))
    await page.locator('.term-popover').screenshot({
      path: `${directory}/${name}-detail.png`,
      scale: 'css',
      animations: 'disabled',
    });
  expect
    .soft(metrics.scrollWidth, `${name}: horizontal overflow`)
    .toBeLessThanOrEqual(metrics.width);
  expect.soft(metrics.smallTargets, `${name}: touch targets below 44px`).toEqual([]);
  expect.soft(metrics.overlappingChapters, `${name}: chapter labels overlap`).toEqual([]);
  if (name.startsWith('report-') && metrics.theme !== 'neutral') {
    const font =
      metrics.theme === 'east'
        ? locale === 'zh'
          ? 'LXGW WenKai'
          : 'Cormorant Garamond'
        : locale === 'en'
          ? 'Cinzel'
          : 'Noto Serif SC';
    expect.soft(metrics.titleFont).toContain(font);
    expect.soft(metrics.loadedFonts).toContain(font);
  }
  await auditLocale(page, locale);
  await audit(page, true);
}

/** Persist a deterministic report fixture for visual and owner-workflow regression. */
export async function seed(
  userId: string,
  system: (typeof polishSystems)[number],
  locale: 'zh' | 'en',
  unknown = false,
) {
  const input = unknown
    ? BirthInputSchema.parse(
        JSON.parse(readFileSync('packages/engine/test/fixtures/birth/E.json', 'utf8')),
      )
    : birth;
  const request = {
    system,
    locale,
    birth: input,
    idempotencyKey: randomUUID(),
    seed: 'fixture-A',
    ...(system === 'tarot' ? { spread: 'celtic_cross' as const } : {}),
    ...(system === 'iching'
      ? { method: 'meihua' as const, numbers: [1, 8, 1] as [number, number, number] }
      : {}),
    ...(system === 'qimen'
      ? {
          question: {
            at: '2026-10-04T00:00:00Z[UTC]',
            place: { lng: input.place!.lng, tz: input.place!.tz },
            category: 'general',
          },
        }
      : {}),
  };
  const result = await generateReading(request, '2026-10-04T00:00:00Z');
  return db.reading.create({
    data: {
      userId,
      system,
      encInput: encryptField(JSON.stringify(request), 'Reading.encInput', userId),
      chart: json(result.chart),
      reportZh: locale === 'zh' ? json(result.report) : undefined,
      reportEn: locale === 'en' ? json(result.report) : undefined,
      schoolUsed: json(result.meta.schoolUsed),
      engineVersion: result.report.engineVersion,
      interpretVersion: result.report.interpretVersion,
      knowledgeVersion: result.report.knowledgeVersion,
    },
  });
}
