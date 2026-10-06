import { test, expect, type Page, type TestInfo, type Locator } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { BirthInputSchema, type Locale } from '@tianji/shared';
import { audit, db, birth } from './m5-helpers';
import { encryptField } from '../lib/crypto';
import { generateReading, json } from '../lib/reading-service';
import zh from '../messages/zh.json' with { type: 'json' };
import en from '../messages/en.json' with { type: 'json' };
import tw from '../messages/zh-TW.json' with { type: 'json' };
import B from '../../../packages/engine/test/fixtures/birth/B.json' with { type: 'json' };

const copies = { zh, en, 'zh-TW': tw };
const instant = '2026-10-05T04:00:00Z';
const pageErrors = new WeakMap<Page, string[]>();
// DESIGN-GAP: Pin the browser zone alongside the clock so CI hosts produce the same calendar and localized dates.
test.use({ timezoneId: 'Asia/Singapore' });
test.beforeEach(async ({ page }) => {
  const errors: string[] = [];
  pageErrors.set(page, errors);
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (/MISSING_MESSAGE|INVALID_MESSAGE/.test(message.text())) errors.push(message.text());
  });
  await page.clock.setFixedTime(new Date(instant));
  await page.addInitScript(() => localStorage.setItem('tianji-disclaimer-v1', 'accepted'));
  await page.route('**/pagead/**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/javascript', body: '' }),
  );
});
test.afterEach(async ({ page }) => expect(pageErrors.get(page)).toEqual([]));
test.afterAll(() => db.$disconnect());

// DESIGN-GAP: New-feature baselines capture the viewport with fixed dates and anonymous fixture labels; full-document axe still scans every rendered control.
async function capture(page: Page, info: TestInfo, name: string, locale: Locale) {
  await expect(page.locator('html')).toHaveAttribute('lang', locale);
  await expect(page.locator('html')).toHaveAttribute('data-fonts-settled', 'true');
  await page.evaluate(() => document.fonts.ready);
  const result = await audit(page);
  await writeFile(info.outputPath(`${name}-axe.json`), JSON.stringify(result, null, 2));
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
    page.viewportSize()!.width,
  );
  const fontBytes = await page.locator('html').getAttribute('data-font-budget');
  expect(fontBytes).not.toBeNull();
  expect(Number(fontBytes)).toBeLessThanOrEqual(350 * 1024);
  await page.mouse.move(0, 0);
  await expect(page).toHaveScreenshot(`${locale}-${name}.png`, { scale: 'css' });
}

/** Reach a control using actual Tab navigation, then activate it without a pointer. */
async function activate(page: Page, control: Locator, key = 'Enter', direction = 'Tab') {
  await expect(control).toBeVisible();
  for (let index = 0; index < 180; index++) {
    if (await control.evaluate((element) => element === document.activeElement)) {
      await page.keyboard.press(key);
      return;
    }
    await page.keyboard.press(direction);
  }
  throw new Error(`Keyboard cannot reach ${await control.textContent()}`);
}

async function owner(page: Page, locale: Locale) {
  // DESIGN-GAP: Calendar draws include user/profile identities; pin them per locale/viewport so repeated screenshot runs use identical scores.
  const variant = `${page.viewportSize()!.width}${['zh', 'en', 'zh-TW'].indexOf(locale)}`;
  const id = `55555555-5555-4555-8555-${variant.padStart(12, '0')}`;
  await db.user.deleteMany({ where: { id } });
  const user = await db.user.create({
    data: {
      id,
      email: `polish-${randomUUID()}@example.test`,
      locale,
      disclaimerAcceptedAt: new Date(instant),
    },
  });
  const token = randomUUID();
  await db.session.create({
    data: { userId: user.id, sessionToken: token, expires: new Date('2030-01-01') },
  });
  await page.context().addCookies([
    {
      name: '__Secure-authjs.session-token',
      value: token,
      domain: 'localhost',
      path: '/',
      httpOnly: true,
      secure: true,
      sameSite: 'Lax',
    },
  ]);
  for (const [index, raw] of [birth, B].entries()) {
    const input = BirthInputSchema.parse(raw),
      { place, gender, ...fields } = input;
    await db.birthProfile.create({
      data: {
        id: `66666666-6666-4666-8666-${`${variant}${index}`.padStart(12, '0')}`,
        userId: user.id,
        isDefault: index === 0,
        relation: index === 0 ? 'self' : 'partner',
        label: encryptField(index === 0 ? 'Alpha' : 'Beta', 'BirthProfile.label', user.id),
        encBirth: encryptField(JSON.stringify(fields), 'BirthProfile.encBirth', user.id),
        encPlace: encryptField(JSON.stringify(place), 'BirthProfile.encPlace', user.id),
        gender,
        timeUnknown: input.timeUnknown,
        tz: place?.tz ?? 'UTC',
        birthYear: input.year,
        chartHash: randomUUID(),
      },
    });
  }
  return user;
}

async function reading(userId: string, locale: Locale, system: 'bazi' | 'numerology' | 'synastry') {
  const request = {
    system,
    locale: locale === 'en' ? ('en' as const) : ('zh' as const),
    birth,
    idempotencyKey: randomUUID(),
    ...(system === 'synastry' ? { partnerBirth: BirthInputSchema.parse(B) } : {}),
  };
  const result = await generateReading(request, instant);
  return db.reading.create({
    data: {
      userId,
      system,
      createdAt: new Date(instant),
      encInput: encryptField(JSON.stringify(request), 'Reading.encInput', userId),
      chart: json(result.chart),
      reportZh: locale !== 'en' ? json(result.report) : undefined,
      reportEn: locale === 'en' ? json(result.report) : undefined,
      schoolUsed: json(result.meta.schoolUsed),
      engineVersion: result.report.engineVersion,
      interpretVersion: result.report.interpretVersion,
      knowledgeVersion: result.report.knowledgeVersion,
    },
  });
}

for (const locale of ['zh', 'en', 'zh-TW'] as const) {
  const t = copies[locale];
  test(`${locale}: new public pages, error states and long learning article`, async ({
    page,
  }, info) => {
    for (const [name, path] of Object.entries({
      'numerology-input': '/numerology/new',
      'rectification-input': '/rectify',
      'calendar-empty': '/today/calendar',
      'profiles-guest': '/me/profiles',
      'synastry-input-guest': '/synastry',
      'chat-guest': '/bazi/r/missing/chat',
      'learn-long': '/learn/synastry/articles/comparison-basics',
    })) {
      const response = await page.goto(`/${locale}${path}`);
      expect(response?.status()).toBe(200);
      if (name === 'learn-long') {
        await expect(page.locator('[data-tutorial-body]')).toBeVisible();
        // Exercise repeated reads after Next promotes the pre-rendered locale cache entry.
        for (let read = 0; read < 2; read++)
          expect((await page.request.get(`/${locale}${path}`)).status()).toBe(200);
      }
      await expect(page.locator('main h1').first()).toBeVisible();
      await capture(page, info, name, locale);
    }
    const next = page.locator('main nav a[href*="/articles/"]').first();
    const destination = await next.getAttribute('href');
    await activate(page, next);
    await expect(page).toHaveURL(new RegExp(`${destination}$`));
    await page.goto(`/${locale}/numerology/new`);
    await page.getByLabel(t['form.birth.year'], { exact: true }).fill('1990');
    await page.getByLabel(t['numerology.name'], { exact: true }).fill('姓名');
    await activate(page, page.getByRole('button', { name: t['form.birth.submit'], exact: true }));
    await expect(page.locator('main').getByRole('alert')).toBeVisible();
    await capture(page, info, 'numerology-error', locale);
  });

  test(`${locale}: new owner pages, dialogs, report controls and keyboard workflows`, async ({
    page,
  }, info) => {
    const user = await owner(page, locale);
    await page.goto(`/${locale}/me/profiles`);
    await expect(page.getByRole('heading', { name: 'Alpha', exact: true })).toBeVisible();
    await capture(page, info, 'profiles', locale);
    const remove = page.getByRole('button', { name: t['profiles.delete'], exact: true }).first();
    await activate(page, remove);
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    for (let index = 0; index < 5; index++) {
      await page.keyboard.press(index % 2 ? 'Shift+Tab' : 'Tab');
      expect(await dialog.evaluate((element) => element.contains(document.activeElement))).toBe(
        true,
      );
    }
    await capture(page, info, 'profile-delete-dialog', locale);
    await page.keyboard.press('Escape');
    await expect(remove).toBeFocused();
    const add = page.getByRole('button', { name: t['profiles.add'], exact: true });
    await activate(page, add);
    await expect(
      page.getByRole('combobox', { name: t['profiles.relation'], exact: true }),
    ).toBeFocused();
    await capture(page, info, 'profile-editor', locale);
    await activate(
      page,
      page
        .locator('.settings-page > .report-card')
        .getByRole('button', { name: t['profiles.cancel'], exact: true }),
    );
    await expect(add).toBeFocused();
    const switcher = page.getByRole('button', { name: t['profiles.switch'], exact: true });
    await activate(page, switcher);
    await expect(dialog.getByRole('button', { name: 'Beta', exact: true })).toBeVisible();
    await capture(page, info, 'profile-switch-dialog', locale);
    await activate(page, dialog.getByRole('button', { name: 'Beta', exact: true }));
    await expect(dialog).toBeHidden();
    await expect(switcher).toBeFocused();
    await page.goto(`/${locale}/synastry`);
    await capture(page, info, 'synastry-input', locale);
    await activate(page, page.getByRole('button', { name: t['synastry.swap'], exact: true }));
    await expect(page.getByLabel(t['synastry.a'], { exact: true })).not.toHaveValue('');
    for (const system of ['synastry', 'numerology', 'bazi'] as const) {
      const row = await reading(user.id, locale, system);
      await page.goto(`/${locale}/${system}/r/${row.id}`);
      await expect(page.locator('#chart-root:visible')).toBeVisible();
      await capture(page, info, `report-${system}`, locale);
      if (system === 'numerology') {
        await activate(page, page.locator('[data-chart-path="lifePath.number"]').first());
        await expect(page.locator('#section-life_path')).toBeFocused();
      }
      if (system === 'synastry') {
        await activate(
          page,
          page.getByRole('button', { name: t['synastry.sideBySide'], exact: true }),
        );
        await expect(page.locator('.synastry-pair').first().locator('svg')).toHaveCount(2);
        await capture(page, info, 'synastry-side-by-side', locale);
      }
      if (system === 'bazi') {
        await activate(page, page.locator('.export-menu summary'));
        await expect(
          page.getByRole('combobox', { name: t['export.theme'], exact: true }),
        ).toBeVisible();
        await capture(page, info, 'export-menu', locale);
        await page.route('**/api/export', (route) => route.fulfill({ status: 503, body: '{}' }));
        await activate(page, page.getByRole('button', { name: t['export.pdf'], exact: true }));
        await expect(page.locator('main').getByRole('alert')).toContainText(t['export.failed']);
        await capture(page, info, 'export-error', locale);
        await activate(page, page.locator('.chat-panel summary'));
        const chip = page.getByRole('button', { name: t['report.chat.chips.bazi.0'], exact: true });
        await expect(chip).toBeVisible();
        await activate(page, chip);
        await expect(page.getByLabel(t['report.chat.question'])).toHaveValue(
          t['report.chat.chips.bazi.0'],
        );
        await capture(page, info, 'chat-inline', locale);
        await activate(
          page,
          page.getByRole('button', { name: t['report.chat.send'], exact: true }),
        );
        await expect(page.locator('.chat-user')).toHaveCount(1);
        await expect(page.getByLabel(t['report.chat.question'])).toHaveValue('');
        await expect(page.getByLabel(t['report.chat.question'])).toBeFocused();
        await activate(
          page,
          page.getByRole('link', { name: t['report.chat.fullScreen'], exact: true }),
          'Enter',
          'Shift+Tab',
        );
        await expect(page.locator('.chat-user')).toHaveCount(1);
        await capture(page, info, 'chat-fullscreen', locale);
        const history = page.getByRole('log', { name: t['report.chat.history'], exact: true });
        await activate(page, history, 'Home');
        await expect(history).toBeFocused();
        await page.keyboard.press('PageDown');
        if (await history.evaluate((element) => element.scrollHeight > element.clientHeight + 1))
          await expect
            .poll(() => history.evaluate((element) => element.scrollTop))
            .toBeGreaterThan(0);
      }
    }
    await page.goto(`/${locale}/rectify`);
    await expect(page.getByLabel(t['rectification.period'])).toBeVisible();
    await capture(page, info, 'rectification-questionnaire', locale);
    const group = page.locator('fieldset').first();
    const radio = group.locator('input[type="radio"]:checked');
    await activate(page, radio, 'Space');
    await expect(radio).toBeChecked();
    await page.keyboard.press('ArrowRight');
    await expect(group.locator('input[type="radio"]').first()).toBeChecked();
    await activate(page, page.getByRole('button', { name: t['rectification.rank'], exact: true }));
    await expect(page.getByTestId('rectification-candidate')).toHaveCount(3);
    await expect(
      page.getByRole('heading', { name: t['rectification.results'], exact: true }),
    ).toBeFocused();
    await capture(page, info, 'rectification-results', locale);
    await page.goto(`/${locale}/today/calendar`);
    await expect(page.locator('[data-calendar-day]')).toHaveCount(31);
    await expect(page.locator('[data-calendar-event="solar_term"]')).toHaveCount(24);
    for (const rect of await page.locator('[data-calendar-day] rect').all()) {
      const bounds = await rect.boundingBox();
      expect(bounds!.width).toBeGreaterThanOrEqual(44);
      expect(bounds!.height).toBeGreaterThanOrEqual(44);
    }
    await capture(page, info, 'calendar', locale);
    await activate(page, page.getByRole('button', { name: t['calendar.next'], exact: true }));
    await expect(page.locator('[data-calendar-day]')).toHaveCount(30);
    const day = page.locator('[data-calendar-day]').first();
    const date = await day.getAttribute('data-calendar-day');
    await activate(page, day);
    await expect(page.locator('[data-daily-block="1"] time')).toHaveAttribute('datetime', date!);
  });
}
