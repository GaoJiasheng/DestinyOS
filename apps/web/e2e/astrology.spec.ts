import { test, expect, type Page } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import zh from '../messages/zh.json';
import en from '../messages/en.json';
const db = new PrismaClient({
  datasourceUrl:
    'postgresql://postgres:postgres@127.0.0.1:57432/postgres?connection_limit=1&statement_cache_size=0',
});
test.afterAll(() => db.$disconnect());
async function create(
  page: Page,
  locale: 'zh' | 'en',
  system: 'astrology' | 'vedic',
  noon: boolean,
) {
  const copy = locale === 'zh' ? zh : en;
  await page.addInitScript(() => localStorage.setItem('tianji-disclaimer-v1', 'accepted'));
  await page.goto(`/${locale}/${system}/new`);
  await page.getByLabel(copy['form.birth.year'], { exact: true }).fill('1990');
  await page.getByLabel(copy['form.birth.month'], { exact: true }).fill('5');
  await page.getByLabel(copy['form.birth.day'], { exact: true }).fill('15');
  if (noon) await page.getByLabel(copy['form.birth.timeUnknown'], { exact: true }).check();
  else {
    await page.getByLabel(copy['form.birth.precise'], { exact: true }).check();
    await page.getByLabel(copy['form.birth.time'], { exact: true }).fill('08:30');
  }
  await page.getByRole('button', { name: copy['form.birth.next'], exact: true }).click();
  await page
    .getByLabel(copy['form.birth.city'], { exact: true })
    .fill(locale === 'zh' ? '北京' : 'Beijing');
  await page.getByRole('option').filter({ hasText: 'Asia/Shanghai' }).first().click();
  await page.getByLabel(copy['form.birth.gender'], { exact: true }).selectOption('male');
  await page.getByRole('button', { name: copy['form.birth.submit'], exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/${locale}/${system}/r/local/`), { timeout: 90_000 });
  await expect(page.locator('#chart-root')).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('data-fonts-settled', 'true', {
    timeout: 15_000,
  });
  await page.evaluate(() => document.fonts.ready);
  return copy;
}
for (const locale of ['zh', 'en'] as const) {
  for (const system of ['astrology', 'vedic'] as const) {
    test(`${locale} ${system}: real form, linked chapters, technical view and visual baselines`, async ({
      page,
      request,
    }, info) => {
      const before = await db.reading.count();
      const copy = await create(page, locale, system, false);
      expect(await db.reading.count()).toBe(before);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
      if (system === 'astrology') {
        const wheel = page.locator('#chart-root .natal-wheel');
        await expect(wheel).toHaveScreenshot(`natal-${locale}.png`);
        const original = await wheel.locator('[data-house="2"] line').getAttribute('x1');
        await page
          .getByLabel(copy['form.birth.houseSystem'], { exact: true })
          .selectOption('equal');
        await expect(wheel).toHaveAttribute('data-house-system', 'equal');
        expect(await wheel.locator('[data-house="2"] line').getAttribute('x1')).not.toBe(original);
        await expect(page.getByText(copy['charts.natal.preview'])).toBeVisible();
        await wheel.locator('[data-body="sun"]').press('Enter');
        await expect(page.locator('#section-big_three')).toBeFocused();
        await page.locator('#chart-root').scrollIntoViewIfNeeded();
        await page.getByRole('button', { name: copy['charts.natal.three'], exact: true }).click();
        await expect(page.getByText(copy['charts.natal.threeFallback'])).toBeVisible();
        await expect(page.locator('[data-three-shell]')).toHaveCount(0);
        await page.locator('#chart-root details > summary').click();
        // DESIGN-GAP: Snapshot the actual scroll viewport, rather than table content clipped by its ancestor.
        await expect(page.locator('#chart-root .planet-table').locator('..')).toHaveScreenshot(
          `planets-${locale}.png`,
        );
      } else {
        for (const division of ['D1', 'D9'] as const) {
          if (info.project.name === 'mobile')
            await page
              .getByRole('button', { name: copy[`charts.vedic.${division}`], exact: true })
              .click();
          const svg = page.getByRole('group', {
            name: copy['charts.vedic.southTitle'].replace('{division}', division),
            exact: true,
          });
          await expect(svg).toHaveScreenshot(`south-${division}-${locale}.png`);
        }
        await expect(page.locator('.nakshatra-card')).toHaveScreenshot(`nakshatra-${locale}.png`);
        const track = page.locator('#chart-root .dasha-track');
        await track.locator('button').first().click();
        await expect(page.locator('#chart-root .antar-table tbody tr')).toHaveCount(9);
        // DESIGN-GAP: Hide the date-dependent pointer/caption in baselines; their presence is tested separately.
        await expect(page.locator('#chart-root .dasha-timeline')).toHaveScreenshot(
          `dasha-${locale}.png`,
          { stylePath: 'apps/web/e2e/astrology-screenshot.css' },
        );
        await expect(page.locator('#chart-root .dasha-pointer')).toHaveCount(1);
        await page.getByLabel(copy['charts.vedic.layout']).selectOption('north');
        for (const division of ['D1', 'D9'] as const) {
          if (info.project.name === 'mobile')
            await page
              .getByRole('button', { name: copy[`charts.vedic.${division}`], exact: true })
              .click();
          const svg = page.getByRole('group', {
            name: copy['charts.vedic.northTitle'].replace('{division}', division),
            exact: true,
          });
          await expect(svg).toHaveScreenshot(`north-${division}-${locale}.png`);
        }
        const visibleChart = page.getByRole('group', {
          name: copy['charts.vedic.northTitle'].replace('{division}', 'D9'),
          exact: true,
        });
        await visibleChart.locator('[data-body]').first().press('Enter');
        await expect(page.locator('#section-navamsa')).toBeFocused();
      }
      await page.getByRole('button', { name: copy['report.proView'], exact: true }).click();
      await expect(page.locator('.professional-view .planet-table')).toBeVisible();
      if (system === 'astrology')
        await expect(
          page.locator('.professional-view .aspect-table').locator('..'),
        ).toHaveScreenshot(`aspects-${locale}.png`);
      else
        await expect(page.locator('.professional-view .antar-table')).toHaveCount(
          await page.locator('#chart-root .dasha-track button').count(),
        );

      await page.getByRole('link', { name: copy['report.loginSave'], exact: true }).click();
      const email = `astro-${locale}-${system}-${info.project.name}-${Date.now()}@example.com`;
      await page.getByLabel(copy['auth.login.email']).fill(email);
      await page.getByRole('button', { name: copy['auth.login.send'], exact: true }).click();
      await expect(page.getByRole('status').filter({ hasText: email })).toBeVisible();
      const outbox = (await (await request.get('http://127.0.0.1:59081/mail')).json()) as {
        to: string;
        text: string;
      }[];
      const link = outbox.find((m) => m.to === email)?.text.match(/http:\/\/[^\s]+/)?.[0];
      if (!link) throw new Error('Missing test magic link');
      await page.goto(link);
      await page.getByRole('button', { name: copy['auth.verify.confirm'], exact: true }).click();
      await expect(page.getByRole('dialog')).toBeVisible();
      await page.getByRole('button', { name: copy['report.import.confirm'], exact: true }).click();
      await expect(page).toHaveURL(new RegExp(`/${locale}/me/history$`), { timeout: 60000 });
      await page.locator('.history-list a').first().click();
      await expect(
        page
          .locator(`#chart-root .${system === 'astrology' ? 'natal-wheel' : 'vedic-chart'}`)
          .first(),
      ).toBeVisible();
      const user = await db.user.findUniqueOrThrow({ where: { email } });
      const rows = await db.reading.findMany({ where: { userId: user.id } });
      expect(rows).toHaveLength(1);
      expect(rows[0]?.encInput).toMatch(/^v1:/);
      if (system === 'astrology') {
        await page
          .getByLabel(copy['form.birth.houseSystem'], { exact: true })
          .selectOption('whole_sign');
        await expect(page.locator('#chart-root .natal-wheel')).toHaveAttribute(
          'data-house-system',
          'whole_sign',
        );
      }
    });
    test(`${locale} ${system}: noonChart omits time-dependent features`, async ({ page }) => {
      const copy = await create(page, locale, system, true);
      await expect(
        page.getByText(copy[system === 'astrology' ? 'charts.natal.noon' : 'charts.vedic.noon']),
      ).toBeVisible();
      await expect(page.locator('#chart-root [data-house]')).toHaveCount(0);
      await expect(page.locator('#chart-root [data-lagna]')).toHaveCount(0);
      await expect(page.locator('#chart-root .axis-label')).toHaveCount(0);
      await expect(page.locator('#chart-root .dasha-pointer')).toHaveCount(0);
      if (system === 'astrology')
        await expect(
          page.getByLabel(copy['form.birth.houseSystem'], { exact: true }),
        ).toBeDisabled();
      else {
        await expect(
          page.getByLabel(copy['charts.vedic.layout']).locator('option[value="north"]'),
        ).toHaveAttribute('disabled', '');
        await expect(page.getByText(copy['charts.vedic.noonDasha'])).toBeVisible();
      }
      await expect(page.locator('#chart-root')).toHaveScreenshot(`noon-${system}-${locale}.png`, {
        stylePath: 'apps/web/e2e/astrology-screenshot.css',
      });
    });
  }
}
