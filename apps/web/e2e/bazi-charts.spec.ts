import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { encryptAnonymous } from '../lib/anonymous-storage';
import { baziFixture, baziReading } from '../test/fixtures/bazi-reading';
import { PILLAR_KEYS } from '../components/charts/bazi-shared';
import zh from '../messages/zh.json';
import en from '../messages/en.json';

for (const locale of ['zh', 'en'] as const) {
  const messages = locale === 'zh' ? zh : en;
  test(`${locale}: chart baselines, snapshot consistency, annual expansion and report anchors`, async ({
    page,
  }) => {
    const reading = baziReading(locale);
    const encrypted = await encryptAnonymous({
      anonId: '33333333-3333-4333-8333-333333333334',
      readings: [reading],
      settings: {},
    });
    await page.addInitScript((data) => {
      localStorage.setItem('tianji-disclaimer-v1', 'accepted');
      localStorage.setItem('tianji.anon', data);
    }, encrypted);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(`/${locale}/bazi/r/local/${reading.id}`);
    const chart = page.locator('#chart-root');
    await expect(chart).toBeVisible();
    // DESIGN-GAP: Deferred body-glyph selection must finish before comparing self-hosted font baselines.
    await expect(page.locator('html')).toHaveAttribute('data-fonts-settled', 'true', {
      timeout: 15_000,
    });
    await page.evaluate(() => document.fonts.ready);
    for (const key of PILLAR_KEYS) {
      const pillar = baziFixture.pillars[key];
      if (!pillar) throw new Error('Fixture requires hour');
      const card = chart.locator(`[data-pillar="${key}"]`);
      await expect(card.locator('[data-stem]')).toHaveText(messages[`bazi.stems.${pillar.stem}`]);
      await expect(card.locator('[data-branch]')).toHaveText(
        messages[`bazi.branches.${pillar.branch}`],
      );
      await expect(card.locator('[data-stem]')).toHaveCSS('color', `rgb(216, 212, 200)`);
    }
    for (const [element, pct] of Object.entries(baziFixture.elements.pct)) {
      await expect(chart.locator(`[data-element="${element}"]`)).toHaveAttribute(
        'data-pct',
        String(pct),
      );
    }
    await expect(chart.getByRole('meter')).toHaveAttribute(
      'data-score',
      String(baziFixture.strength.score),
    );
    await expect(chart.locator('[data-period]')).toHaveCount(10);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
    for (const [name, selector] of [
      ['pillars', '[data-chart-path="pillars"]'],
      ['elements', '[data-chart-path="elements"]'],
      ['strength', '[data-chart-path="strength"]'],
      ['luck', '[data-chart-path="luck"]'],
      ['relations', '[data-chart-path="relations"]'],
    ]) {
      // DESIGN-GAP: Independent chart snapshots use soft assertions so one stale baseline does not hide later visual or interaction failures.
      await expect.soft(chart.locator(selector!)).toHaveScreenshot(`bazi-${name}-${locale}.png`, {
        animations: 'disabled',
        maxDiffPixelRatio: 0.005,
      });
    }
    const current = baziFixture.luck.periods.find((period) => period.isCurrent)!;
    await chart.locator(`[data-period="${current.index}"]`).click();
    const expected = baziFixture.years.filter(
      (year) => year.year >= current.fromYear && year.year <= current.toYear,
    );
    expect(
      await chart
        .locator('[data-year]')
        .evaluateAll((nodes) => nodes.map((node) => Number(node.getAttribute('data-year')))),
    ).toEqual(expected.map((year) => year.year));
    await expect
      .soft(chart.locator('[data-chart-path="luck"]'))
      .toHaveScreenshot(`bazi-luck-expanded-${locale}.png`, {
        animations: 'disabled',
        maxDiffPixelRatio: 0.005,
      });
    await chart.locator('[data-chart-path="pillars.day"]').click();
    await expect(page.locator('#section-day_master')).toBeFocused();
    await expect(chart.locator('[data-chart-path="pillars.day"]')).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await page.locator('#section-elements .evidence-tags button').click();
    await expect(chart.locator('[data-chart-path="elements.pct.wood"]')).toBeFocused();
    await expect(chart.locator('[data-chart-path="elements.pct.wood"]')).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    // Evidence also reopens a folded chart and expands its stored current annual period.
    await page.locator('.report-chart > details > summary').click();
    await page.locator('#section-luck_timeline .evidence-tags button').click();
    await expect(chart).toBeVisible();
    const currentYearIndex = baziFixture.years.findIndex((year) => year.isCurrent);
    await expect(chart.locator(`[data-chart-path="years.${currentYearIndex}"]`)).toBeFocused();
    await page.getByRole('button', { name: messages['report.proView'], exact: true }).click();
    await expect(chart.locator('.bazi-full-table')).toBeVisible();
    await expect
      .soft(chart.locator('.bazi-professional'))
      .toHaveScreenshot(`bazi-professional-${locale}.png`, {
        animations: 'disabled',
        maxDiffPixelRatio: 0.005,
      });
    expect(
      await page.locator('[id]').evaluateAll((nodes) => {
        const ids = nodes.map((node) => node.id);
        return ids.filter((id, i) => ids.indexOf(id) !== i);
      }),
    ).toEqual([]);
    const audit = await new AxeBuilder({ page })
      .include('#chart-root')
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();
    expect(audit.violations).toEqual([]);
  });
}
