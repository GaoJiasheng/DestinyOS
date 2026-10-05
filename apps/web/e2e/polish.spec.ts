import { test, expect, type Page, type TestInfo } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { BirthInputSchema } from '@tianji/shared';
import { audit, auditLocale, birth, copies, db, fillBirth, login } from './m5-helpers';
import { generateReading, json } from '../lib/reading-service';
import { encryptField } from '../lib/crypto';

const systems = ['bazi', 'ziwei', 'iching', 'qimen', 'tarot', 'astrology', 'vedic'] as const;
test.beforeEach(async ({ page }) => {
  await page.route('**/pagead/**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/javascript', body: '' }),
  );
  await page.addInitScript(() => localStorage.setItem('tianji-disclaimer-v1', 'accepted'));
});
test.afterAll(() => db.$disconnect());

async function capture(page: Page, info: TestInfo, name: string, locale: 'zh' | 'en') {
  await expect(page.locator('html')).toHaveAttribute('data-fonts-settled', 'true');
  await page.evaluate(() => document.fonts.ready);
  await page.mouse.move(0, 0);
  const directory = `test-results/polish/${info.project.name}/${locale}`;
  await mkdir(directory, { recursive: true });
  const dialogOpen = name.endsWith('-dialog');
  if (dialogOpen) await expect(page.getByRole('dialog')).toBeVisible();
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

async function seed(
  userId: string,
  system: (typeof systems)[number],
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

for (const locale of ['en', 'zh'] as const) {
  const copy = copies[locale];
  test(`${locale}: public pages, birth steps and empty states`, async ({ page }, info) => {
    for (const [name, path] of Object.entries({
      home: '',
      login: '/auth/login',
      pricing: '/pricing',
      me: '/me',
      settings: '/me/settings',
      'learn-card': '/learn/tarot/major_00_fool',
      'learn-hexagram': '/learn/iching/hexagram_01',
      'daily-empty': '/today',
      'history-empty': '/me/history',
    })) {
      await page.goto(`/${locale}${path}`);
      if (path === '/today') await expect(page.locator('[data-daily-block="1"]')).toBeVisible();
      await capture(page, info, name, locale);
    }
    await page.goto(`/${locale}/bazi/new`);
    await page.getByLabel(copy['form.birth.year'], { exact: true }).fill('1990');
    await page.getByLabel(copy['form.birth.month'], { exact: true }).fill('5');
    await page.getByLabel(copy['form.birth.day'], { exact: true }).fill('15');
    await capture(page, info, 'birth-step-1', locale);
    await page.getByLabel(copy['form.birth.timeUnknown'], { exact: true }).check();
    await capture(page, info, 'birth-unknown', locale);
    await page.getByLabel(copy['form.birth.timeUnknown'], { exact: true }).uncheck();
    await fillBirth(page, locale);
    await capture(page, info, 'birth-step-2', locale);
    await page.goto(`/${locale}/ziwei/new`);
    await page.getByLabel(copy['form.birth.timeUnknown'], { exact: true }).check();
    await expect(page.locator('.ziwei-time-required')).toBeVisible();
    await capture(page, info, 'ziwei-unknown-blocked', locale);
    await page.goto(`/${locale}/bazi/r/missing-polish`);
    await capture(page, info, 'report-error', locale);
  });

  test(`${locale}: seven Fixture A reports, chips, evidence and chart interaction`, async ({
    page,
    request,
  }, info) => {
    const user = await login(page, request, locale);
    for (const system of systems) {
      const row = await seed(user.id, system, locale);
      await page.goto(`/${locale}/${system}/r/${row.id}`);
      await expect(page.locator('#chart-root:visible')).toBeVisible();
      await capture(page, info, `report-${system}`, locale);
      if (system === 'bazi') {
        await expect(page.locator('.report-chart .bazi-pillar')).toHaveCount(4);
        for (const pillar of await page.locator('.report-chart .bazi-pillar').all())
          await expect(pillar).toHaveCSS('opacity', '1');
      }
      if (system === 'vedic') {
        const scale = await page.locator('.dasha-track').evaluate((track) => ({
          width: track.getBoundingClientRect().width,
          viewport: track.parentElement!.clientWidth,
        }));
        expect(scale.width).toBeLessThanOrEqual(Math.max(900, scale.viewport) + 1);
      }
      await expect(page.locator('.ad-slot')).toHaveCount(2);
      for (const ad of await page.locator('.ad-slot').all()) {
        const before = await ad.boundingBox();
        await expect(ad).toContainText(copy['report.ad']);
        expect(before!.height).toBeGreaterThanOrEqual(info.project.name === '375' ? 280 : 250);
      }
      await expect(page.locator('html')).toHaveAttribute(
        'data-theme',
        ['tarot', 'astrology'].includes(system) ? 'west' : system === 'vedic' ? 'vedic' : 'east',
      );
      const chip = page.locator('.report-body .term-chip').first();
      await expect(chip).toBeVisible();
      await chip.click();
      await expect(page.locator('.term-popover')).toBeVisible();
      await capture(page, info, `term-${system}`, locale);
      await page.keyboard.press('Escape');
      const evidence = page.locator('.report-body .evidence-tags button').first();
      await expect(evidence).toBeVisible();
      await evidence.click();
      await expect(page.locator('.report-chart .evidence-highlight').first()).toBeVisible();
      if (system === 'ziwei') {
        await page.locator('#chart-root [data-palace="wealth"]').click();
        const board = page.getByRole('dialog').getByTestId('ziwei-board');
        if (await board.isVisible()) {
          await board.locator('[data-palace="career"]').click();
          await expect(board.locator('[data-related="true"]')).toHaveCount(4);
          await page.keyboard.press('Escape');
        } else await expect(page.locator('#chart-root [data-related="true"]')).toHaveCount(4);
      }
      if (system === 'astrology') {
        await page
          .getByLabel(copy['form.birth.houseSystem'], { exact: true })
          .selectOption('equal');
        await expect(page.locator('#chart-root .natal-wheel')).toHaveAttribute(
          'data-house-system',
          'equal',
        );
        await page.locator('#chart-root [data-body="sun"] .planet-glyph').click({ force: true });
        await expect(page.locator('#section-big_three')).toBeFocused();
      }
      const path = new URL(page.url()).pathname.replace(`/${locale}`, '');
      await page
        .getByRole('combobox', { name: copy['nav.language'] })
        .first()
        .selectOption(locale === 'zh' ? 'en' : 'zh');
      await expect(page).toHaveURL(new RegExp(`${locale === 'zh' ? '/en' : '/zh'}${path}$`));
    }
    for (const system of ['bazi', 'astrology', 'vedic'] as const) {
      const row = await seed(user.id, system, locale, true);
      await page.goto(`/${locale}/${system}/r/${row.id}`);
      await expect(page.locator('#chart-root:visible')).toBeVisible();
      await capture(page, info, `report-${system}-unknown`, locale);
    }
  });

  test(`${locale}: loading, recoverable error, no city and device preferences`, async ({
    page,
    request,
  }, info) => {
    await login(page, request, locale);
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.route('**/today', async (route) => {
      if (route.request().method() === 'POST') {
        await gate;
        await route.abort('failed');
      } else await route.continue();
    });
    await page.goto(`/${locale}/today`);
    await expect(
      page.getByRole('status').filter({ hasText: copy['common.loading'] }),
    ).toBeVisible();
    await capture(page, info, 'daily-loading', locale);
    release();
    await expect(page.getByRole('alert')).toBeVisible();
    await capture(page, info, 'daily-error', locale);
    await page.unroute('**/today');
    await page.getByRole('button', { name: copy['common.retry'], exact: true }).click();
    await expect(page.locator('.daily-example-overlay')).toBeVisible();
    await page.goto(`/${locale}/bazi/new`);
    await fillBirth(page, locale);
    await page.getByLabel(copy['form.birth.city'], { exact: true }).fill('zzzzpolishmissingcity');
    await expect(page.getByText(copy['form.birth.city.empty'], { exact: true })).toBeVisible();
    await capture(page, info, 'birth-city-empty', locale);
    await page.goto(`/${locale}/me/settings`);
    await page
      .getByRole('combobox', { name: copy['nav.theme'], exact: true })
      .last()
      .selectOption('west');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'west');
    await page.getByLabel(copy['me.motion'], { exact: true }).check();
    await page.getByRole('button', { name: copy['me.save'], exact: true }).click();
    await expect(page.getByRole('status').filter({ hasText: copy['me.saved'] })).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('data-reduced-motion', 'true');
    await page.goto(`/${locale}/bazi`);
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'west');
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-reduced-motion', 'true');
  });

  test(`${locale}: tarot, six coins, numbers and Qimen rituals`, async ({ page }, info) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.addInitScript(() => localStorage.setItem('tianji-reduced-motion', 'true'));
    // DESIGN-GAP: Fixed UUID seeds have a viewport/locale namespace because anonymous idempotency is scoped by IP; encryption keeps secure random bytes.
    await page.addInitScript(
      (namespace: number) => {
        crypto.randomUUID = () => {
          const n = Number(sessionStorage.getItem('tianji-polish-uuid') ?? 0) + 1;
          sessionStorage.setItem('tianji-polish-uuid', String(n));
          return `0000000${namespace}-0000-4000-8000-${String(n).padStart(12, '0')}`;
        };
      },
      (info.project.name === '375' ? 0 : 2) + (locale === 'en' ? 1 : 2),
    );
    await page.clock.setFixedTime(new Date('2026-10-04T00:00:00Z'));
    await page.goto(`/${locale}/tarot`);
    await page.getByText(copy['tarot.seed'], { exact: true }).click();
    await page.locator('[name="seed"]').fill('fixture-A');
    await page.getByRole('button', { name: copy['tarot.begin'], exact: true }).click();
    await page.getByRole('button', { name: copy['tarot.shuffle'], exact: true }).click();
    await page.getByRole('button', { name: copy['tarot.next'], exact: true }).click();
    await page.getByRole('button', { name: copy['tarot.split'], exact: true }).click();
    for (const number of [3, 1, 2])
      await page
        .getByRole('button', {
          name: copy['tarot.pile'].replace('{number}', String(number)),
          exact: true,
        })
        .click();
    await page.getByRole('button', { name: copy['tarot.next'], exact: true }).click();
    await expect(page.locator('.tarot-fan-card')).toHaveCount(25);
    await capture(page, info, 'tarot-fan', locale);
    await page.locator('.tarot-fan-card:not(:disabled)').nth(12).click();
    await page.getByRole('button', { name: copy['tarot.auto'], exact: true }).click();
    await page.getByRole('button', { name: copy['tarot.revealAll'], exact: true }).click();
    await expect(page.locator('.tarot-face').first()).toBeVisible();
    await expect(page.locator('.tarot-back').first()).toBeHidden();
    await expect(page.locator('.tarot-flipper').first()).toHaveCSS('transform', 'none');
    await capture(page, info, 'tarot-reveal', locale);
    await page.getByRole('button', { name: copy['tarot.result'], exact: true }).click();
    await expect(page.locator('.report-layout')).toBeVisible();
    for (const method of ['coins', 'numbers'] as const) {
      await page.goto(`/${locale}/iching/cast?method=${method === 'coins' ? 'liuyao' : method}`);
      await page
        .getByRole('button', {
          name: locale === 'zh' ? '下一步 · 开始仪式' : 'Continue to the ritual',
          exact: true,
        })
        .click();
      if (method === 'coins') {
        for (let n = 0; n < 6; n++) {
          await page
            .getByRole('button', { name: locale === 'zh' ? '摇' : 'Shake', exact: true })
            .click();
          if (n < 5) await expect(page.getByRole('status')).toContainText(`${n + 1} / 6`);
          if (n === 2) await capture(page, info, 'liuyao-ritual', locale);
        }
      } else {
        for (const [n, value] of ['1', '8', '1'].entries())
          await page
            .getByLabel(locale === 'zh' ? `第 ${n + 1} 个数` : `Number ${n + 1}`)
            .fill(value);
        await page
          .getByRole('button', {
            name: locale === 'zh' ? '以这些数字起卦' : 'Cast these numbers',
            exact: true,
          })
          .click();
      }
      await expect(page).toHaveURL(new RegExp(`/${locale}/iching/r/local/`), { timeout: 90000 });
      await expect(page.locator('#chart-root:visible')).toBeVisible();
      await capture(page, info, `iching-${method}`, locale);
    }
    await page.goto(`/${locale}/qimen`);
    await page.getByLabel(locale === 'zh' ? '起局时刻' : 'Casting time').fill('2026-10-04T12:00');
    await page
      .getByRole('button', { name: locale === 'zh' ? '起局' : 'Cast Qimen', exact: true })
      .click();
    await expect(page).toHaveURL(new RegExp(`/${locale}/qimen/r/local/`), { timeout: 90000 });
    await expect(page.getByTestId('qimen-chart').locator('.qimen-palace')).toHaveCount(9);
    await capture(page, info, 'qimen-cast', locale);
  });

  test(`${locale}: saved profile, daily gesture, sharing download and delete account`, async ({
    page,
    request,
  }, info) => {
    const user = await login(page, request, locale);
    await page.goto(`/${locale}/me/birth`);
    await fillBirth(page, locale);
    await page.getByRole('button', { name: copy['form.birth.save'], exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`/${locale}/me$`));
    await expect(page.getByRole('heading', { name: copy['me.guest'], exact: true })).toHaveCount(0);
    await capture(page, info, 'me-profile', locale);
    await page.goto(`/${locale}/today`);
    await expect(page.locator('[data-daily-block="10"] li')).toHaveCount(6);
    await capture(page, info, 'daily', locale);
    const dateBefore = await page.locator('[data-daily-block="1"] time').getAttribute('datetime');
    await page.locator('.daily-body').evaluate((el) => {
      el.dispatchEvent(
        new TouchEvent('touchstart', {
          bubbles: true,
          touches: [new Touch({ identifier: 1, target: el, clientX: 280, clientY: 200 })],
        }),
      );
      el.dispatchEvent(
        new TouchEvent('touchend', {
          bubbles: true,
          changedTouches: [new Touch({ identifier: 1, target: el, clientX: 80, clientY: 200 })],
        }),
      );
    });
    await expect(page.locator('[data-daily-block="1"]')).toBeVisible();
    await expect(page.locator('[data-daily-block="1"] time')).not.toHaveAttribute(
      'datetime',
      dateBefore!,
    );
    await expect(
      page.getByRole('button', { name: copy['daily.tomorrow'], exact: true }),
    ).toBeDisabled();
    const row = await seed(user.id, 'bazi', locale);
    await page.goto(`/${locale}/bazi/r/${row.id}`);
    await expect(page.locator('.login-link')).toHaveAttribute('href', `/${locale}/me`);
    await page.getByRole('button', { name: copy['report.share'], exact: true }).click();
    const dialog = page.getByRole('dialog');
    await dialog
      .getByRole('combobox', { name: copy['share.reveal'], exact: true })
      .selectOption('1');
    await dialog.getByRole('button', { name: copy['share.generate'], exact: true }).click();
    await expect(dialog.getByAltText(copy['share.preview'])).toBeVisible();
    await capture(page, info, 'share-dialog', locale);
    const downloadPromise = page.waitForEvent('download');
    await dialog.getByRole('link', { name: copy['share.download'], exact: true }).click();
    const download = await downloadPromise;
    await download.saveAs(`test-results/polish/${info.project.name}/${locale}/share-download.png`);
    const link = await db.shareLink.findFirstOrThrow({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
    });
    await page.keyboard.press('Escape');
    await page.goto(`/s/${link.token}?locale=${locale}`);
    await capture(page, info, 'share-public', locale);
    await page.goto(`/${locale}/me/settings`);
    await page
      .getByRole('combobox', { name: copy['nav.theme'], exact: true })
      .last()
      .selectOption('west');
    await page.getByLabel(copy['me.motion'], { exact: true }).check();
    await page.getByRole('button', { name: copy['me.save'], exact: true }).click();
    await expect(page.getByRole('status').filter({ hasText: copy['me.saved'] })).toBeVisible();
    await page.goto(`/s/${link.token}?locale=${locale}`);
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'west');
    await expect(page.locator('html')).toHaveAttribute('data-reduced-motion', 'true');
    await page.goto(`/${locale}/me/settings`);
    await page.getByRole('button', { name: copy['me.delete'], exact: true }).click();
    await capture(page, info, 'delete-dialog', locale);
    await page.getByLabel(copy['me.deleteConfirm'], { exact: true }).fill('DELETE');
    await page.getByRole('button', { name: copy['me.deleteFinal'], exact: true }).click();
    await expect(page).toHaveURL(/auth\/login\?deleted=1/);
    expect(await db.session.count({ where: { userId: user.id } })).toBe(0);
    expect((await request.get(`/s/${link.token}`)).status()).toBe(404);
  });
}
