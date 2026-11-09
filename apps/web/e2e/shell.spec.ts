import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { brand } from '../../../packages/shared/src/brand';
import zh from '../messages/zh.json' with { type: 'json' };
import en from '../messages/en.json' with { type: 'json' };
for (const locale of ['zh', 'en'] as const) {
  const messages = locale === 'zh' ? zh : en;
  test(`${locale}: first-visit acknowledgement, translated hero, locale switch, and screenshots`, async ({
    page,
  }, testInfo) => {
    await page.goto(`/${locale}`);
    // DESIGN-GAP: A cold local dev build can spend over 5s compiling client hydration; allow 15s for the notice bar within the shared 60s cold-start budget.
    const notice = page.getByRole('complementary', { name: messages['legal.firstVisit.label'] });
    await expect(notice).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await page.getByRole('button', { name: messages['legal.firstVisit.confirm'] }).click();
    await expect(notice).toBeHidden();
    await expect(page.getByRole('heading', { level: 1 })).toContainText(brand.nameZh);
    await expect(page.getByRole('heading', { level: 1 })).toContainText(brand.nameEn);
    await expect(page.getByText(messages['brand.tagline'], { exact: true })).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('lang', locale);
    await page.screenshot({
      path: `test-results/home-${locale}-${testInfo.project.name}.png`,
      fullPage: true,
    });
    await page.reload();
    await expect(page.getByRole('dialog')).toBeHidden();
    await page
      .getByRole('combobox', { name: messages['nav.language'] })
      .first()
      .selectOption(locale === 'zh' ? 'en' : 'zh');
    await expect(page).toHaveURL(new RegExp(`/${locale === 'zh' ? 'en' : 'zh'}$`));
    const next = locale === 'zh' ? 'en' : 'zh';
    // DESIGN-GAP: A full locale navigation changes the address before the new document and middleware cookie arrive; assert the settled language and persisted preference together.
    await expect(page.locator('html')).toHaveAttribute('lang', next);
    await expect
      .poll(
        async () =>
          (await page.context().cookies()).find((cookie) => cookie.name === 'NEXT_LOCALE')?.value,
      )
      .toBe(next);
  });
  test(`${locale}: token gallery, theme lock, chip, and accessibility`, async ({
    page,
  }, testInfo) => {
    await page.addInitScript(() => localStorage.setItem('tianji-disclaimer-v1', 'accepted'));
    await page.goto(`/${locale}/dev/tokens`);
    await expect(
      page.getByRole('heading', { name: messages['dev.tokens.title'], exact: true }),
    ).toBeVisible();
    for (const theme of ['east', 'west', 'vedic'])
      await expect(page.locator(`.theme-sample[data-theme="${theme}"]`)).toBeVisible();
    await page
      .getByRole('button', { name: messages['dev.tokens.chip'], exact: true })
      .first()
      .click();
    await expect(page.getByText(messages['dev.tokens.chipDescription'])).toBeVisible();
    await page.keyboard.press('Escape');
    await page.getByRole('combobox', { name: messages['nav.theme'] }).selectOption('east');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'east');
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'east');
    await page.getByRole('button', { name: messages['dev.tokens.toast'], exact: true }).click();
    await expect(page.getByText(messages['dev.tokens.toastMessage'])).toBeVisible();
    // Audit the settled theme, rather than intermediate colors during its documented transition.
    await expect(page.locator('.theme-sample[data-theme="east"] .button-primary')).toHaveCSS(
      'color',
      'rgb(255, 255, 255)',
    );
    await expect(
      page.getByRole('button', { name: messages['dev.tokens.toast'], exact: true }),
    ).toHaveCSS('color', 'rgb(255, 255, 255)');
    const result = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();
    expect(result.violations).toEqual([]);
    await page.screenshot({
      path: `test-results/tokens-${locale}-${testInfo.project.name}.png`,
      fullPage: true,
    });
  });
}
// DESIGN-GAP: Cold dev compilation of /tarot/reading (with its knowledge bundle) took up to 60s on a loaded host; keep every flow assertion and allow for it.
const firstUseTimeout = 300_000;
function consentDialog(page: Page) {
  return page.getByRole('dialog', { name: zh['legal.firstVisit.title'] });
}
test('a first-time visitor confirms in place before drawing tarot, and only once', async ({
  page,
}) => {
  test.setTimeout(firstUseTimeout);
  await page.goto('/zh/tarot');
  const question = page.getByRole('textbox', { name: zh['tarot.question'] });
  await question.fill('今年适合换工作吗');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 30_000 });
  const begin = page.getByRole('button', { name: zh['tarot.begin'] });
  await begin.click();
  const dialog = consentDialog(page);
  await expect(dialog).toBeVisible({ timeout: 30_000 });
  await expect(dialog).toContainText(zh['legal.ageConfirmation']);
  await dialog.getByRole('button', { name: zh['legal.consent.cancel'] }).click();
  await expect(dialog).toBeHidden();
  await expect(page).toHaveURL(/\/zh\/tarot$/);
  await expect(question).toHaveValue('今年适合换工作吗');
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem('tianji-disclaimer-v1')))
    .toBeNull();
  await begin.click();
  await dialog.getByRole('button', { name: zh['legal.consent.confirm'] }).click();
  await expect(page).toHaveURL(/\/zh\/tarot\/reading$/, { timeout: 150_000 });
  expect(await page.evaluate(() => localStorage.getItem('tianji-disclaimer-v1'))).toBe('accepted');
  await page.goto('/zh/tarot');
  await page.getByRole('button', { name: zh['tarot.begin'] }).click();
  await expect(page).toHaveURL(/\/zh\/tarot\/reading$/, { timeout: 150_000 });
  await expect(consentDialog(page)).toHaveCount(0);
});
test('dismissing the notice bar is not an age confirmation', async ({ page }) => {
  test.setTimeout(firstUseTimeout);
  await page.goto('/zh/iching/cast?method=time');
  const notice = page.getByRole('complementary', { name: zh['legal.firstVisit.label'] });
  await notice.getByRole('button', { name: zh['legal.firstVisit.confirm'] }).click();
  await expect(notice).toBeHidden();
  await page.getByRole('button', { name: zh['divination.continue'] }).click();
  await expect(consentDialog(page)).toHaveCount(0);
  await page.getByRole('button', { name: zh['divination.castTime'] }).click();
  await expect(consentDialog(page)).toBeVisible({ timeout: 30_000 });
});
test('initial language negotiation honors Accept-Language and defaults to zh', async ({
  request,
}) => {
  for (const [language, locale] of [
    ['en-US,en;q=0.9', 'en'],
    ['zh-CN,zh;q=0.9', 'zh'],
    ['ja', 'zh'],
  ] as const) {
    const response = await request.get('/', {
      // Each case tests a fresh visitor; preceding redirects must not supply a locale cookie.
      headers: { 'Accept-Language': language, Cookie: '' },
      maxRedirects: 0,
    });
    expect(response.status()).toBe(307);
    expect(response.headers()['location']).toMatch(new RegExp(`/${locale}$`));
  }
  const remembered = await request.get('/', {
    headers: { 'Accept-Language': 'en', Cookie: 'NEXT_LOCALE=zh' },
    maxRedirects: 0,
  });
  expect(remembered.headers()['location']).toMatch(/\/zh$/);
});
test('route themes and reduced-motion starfield follow documented behavior', async ({ page }) => {
  // DESIGN-GAP: Five cold dev routes share one test; allow two minutes for compilation while keeping every theme and motion assertion.
  test.setTimeout(120_000);
  await page.addInitScript(() => localStorage.setItem('tianji-disclaimer-v1', 'accepted'));
  for (const [path, theme] of [
    ['bazi', 'east'],
    ['tarot', 'west'],
    ['vedic', 'vedic'],
    ['today', 'neutral'],
  ] as const) {
    await page.goto(`/zh/${path}`);
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
  }
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(page.locator('.stars-small')).toHaveCSS('animation-name', 'none');
  await page.goto('/zh/this-route-does-not-exist');
  await expect(page.getByRole('heading', { name: zh['errors.notFound.title'] })).toBeVisible();
});
