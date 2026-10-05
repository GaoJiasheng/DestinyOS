import { test, expect } from '@playwright/test';
import zh from '../messages/zh.json';
import en from '../messages/en.json';
import type { Page } from '@playwright/test';
async function measureFrames(page: Page): Promise<number> {
  return page.evaluate(
    () =>
      new Promise<number>((resolve) => {
        const began = performance.now();
        let frames = 0;
        const frame = (now: number) => {
          frames++;
          if (now - began >= 1200) resolve((frames * 1000) / (now - began));
          else requestAnimationFrame(frame);
        };
        requestAnimationFrame(frame);
      }),
  );
}
async function measureFlip(page: Page): Promise<{ fps: number; animated: boolean }> {
  return page.evaluate(
    () =>
      new Promise<{ fps: number; animated: boolean }>((resolve) => {
        const flipper = document.querySelector('.tarot-flipper');
        if (!flipper) throw new Error('Missing face-down card');
        const began = performance.now();
        let frames = 0;
        let animated = false;
        const frame = (now: number) => {
          frames++;
          const rotation = new DOMMatrixReadOnly(getComputedStyle(flipper).transform).m11;
          if (flipper.isConnected && Math.abs(rotation) < 0.99) animated = true;
          if (now - began >= 1200) resolve({ fps: (frames * 1000) / (now - began), animated });
          else requestAnimationFrame(frame);
        };
        requestAnimationFrame(frame);
      }),
  );
}
for (const locale of ['zh', 'en'] as const) {
  const m = locale === 'zh' ? zh : en;
  test(`${locale}: tarot ritual, offline report and reproducible bilingual snapshot`, async ({
    page,
  }, testInfo) => {
    test.setTimeout(120_000);
    await page.addInitScript(() => localStorage.setItem('tianji-disclaimer-v1', 'accepted'));
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(`/${locale}/tarot`);
    await expect(page.getByRole('radio')).toHaveCount(8);
    await page.locator('[name="question"]').fill('Private question 36');
    await page.getByText(m['tarot.seed'], { exact: true }).click();
    await page.locator('[name="seed"]').fill('test-seed-001');
    await page.getByRole('button', { name: m['tarot.begin'] }).click();
    await expect(page).toHaveURL(new RegExp(`/${locale}/tarot/reading$`));
    await expect(page.getByRole('button', { name: m['tarot.next'], exact: true })).toBeDisabled();
    await expect(page.getByRole('button', { name: m['tarot.sound'], exact: true })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    await expect(page.locator('.tarot-deck-proxy')).toHaveCount(36);
    await expect(page.locator('img[src*="/tarot/rws/"]')).toHaveCount(0);
    const shuffleFrames = measureFrames(page);
    await page.getByRole('button', { name: m['tarot.shuffle'], exact: true }).click();
    const shuffleFps = await shuffleFrames;
    expect(shuffleFps).toBeGreaterThanOrEqual(45);
    await page.getByRole('button', { name: m['tarot.next'], exact: true }).click();
    const cutFrames = measureFrames(page);
    await page.getByRole('button', { name: m['tarot.split'], exact: true }).click();
    for (const n of [3, 1, 2])
      await page
        .getByRole('button', { name: m['tarot.pile'].replace('{number}', String(n)), exact: true })
        .click();
    await page.getByRole('button', { name: m['tarot.next'], exact: true }).click();
    const cutFps = await cutFrames;
    expect(cutFps).toBeGreaterThanOrEqual(45);
    await expect(page.locator('.tarot-fan-card')).toHaveCount(25);
    const fanFrames = measureFrames(page);
    await page.locator('.tarot-fan-card:not(:disabled)').nth(12).click();
    await page.getByRole('button', { name: m['tarot.auto'], exact: true }).click();
    const fanFps = await fanFrames;
    expect(fanFps).toBeGreaterThanOrEqual(45);
    await expect(page.getByRole('button', { name: m['tarot.result'], exact: true })).toBeDisabled();
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await expect(page.locator('.tarot-face').first()).toBeHidden();
    await expect(page.locator('.tarot-back').first()).toBeVisible();
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    const flipFrames = measureFlip(page);
    await page.getByRole('button', { name: m['tarot.revealAll'], exact: true }).click();
    const { fps: flipFps, animated } = await flipFrames;
    expect(flipFps).toBeGreaterThanOrEqual(45);
    expect(animated).toBe(true);
    await testInfo.attach('tarot-frames', {
      body: JSON.stringify({ shuffleFps, cutFps, fanFps, flipFps }),
      contentType: 'application/json',
    });
    await expect(page.locator('.tarot-card[data-card]')).toHaveCount(3);
    await expect(page.locator('.tarot-card > button').first()).toHaveCSS('opacity', '1');
    const drawn = await page
      .locator('.tarot-card')
      .evaluateAll((nodes) =>
        nodes.map((n) => [n.getAttribute('data-card'), n.getAttribute('data-reversed')]),
      );
    await page.screenshot({
      path: `test-results/tarot-${locale}-${testInfo.project.name}.png`,
      fullPage: true,
    });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await expect(page.locator('.tarot-face').first()).toBeVisible();
    await expect(page.locator('.tarot-back').first()).toBeHidden();
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.context().setOffline(true);
    await page.getByRole('button', { name: m['tarot.result'], exact: true }).click();
    await expect(page.locator('.report-layout')).toBeVisible({ timeout: 30_000 });
    await expect(page.locator('.tarot-detail')).toHaveCount(3);
    await page.context().setOffline(false);
    const id = await page.evaluate(async () => {
      const envelope = JSON.parse(localStorage.getItem('tianji.anon') ?? '{}') as {
        ciphertext?: unknown[];
      };
      if (!envelope.ciphertext) throw new Error('Snapshot must be encrypted');
      return null;
    });
    expect(id).toBeNull();
    expect(await page.evaluate(() => localStorage.getItem('tianji.anon'))).not.toContain(
      'Private question 36',
    );
    await page.goto(`/${locale}/me/history`);
    await page.locator('.history-list a').first().click();
    await expect(page).toHaveURL(/\/tarot\/r\/local\//);
    await expect(page.locator('.tarot-detail')).toHaveCount(3);
    const saved = await page
      .locator('.report-chart .tarot-card')
      .evaluateAll((nodes) =>
        nodes.map((n) => [n.getAttribute('data-card'), n.getAttribute('data-reversed')]),
      );
    expect(saved).toEqual(drawn);
    await page.reload();
    await expect(page.locator('.tarot-detail')).toHaveCount(3);
    const otherLocale = locale === 'zh' ? 'en' : 'zh';
    await page.getByRole('combobox', { name: m['nav.language'] }).first().selectOption(otherLocale);
    await expect(page).toHaveURL(new RegExp(`/${otherLocale}/tarot/r/local/`));
    await expect(page.locator('.tarot-detail')).toHaveCount(3);
    expect(
      await page
        .locator('.report-chart .tarot-card')
        .evaluateAll((nodes) =>
          nodes.map((n) => [n.getAttribute('data-card'), n.getAttribute('data-reversed')]),
        ),
    ).toEqual(drawn);
    // DESIGN-GAP: T-39 replaced the old standalone daily-card markup with the documented profile-dependent 13-block page; verify its actual flipped card with a real Fixture A device profile.
    const dailyCopy = otherLocale === 'zh' ? zh : en;
    await page.goto(`/${otherLocale}/me/birth`);
    await page.getByLabel(dailyCopy['form.birth.year'], { exact: true }).fill('1990');
    await page.getByLabel(dailyCopy['form.birth.month'], { exact: true }).fill('5');
    await page.getByLabel(dailyCopy['form.birth.day'], { exact: true }).fill('15');
    await page.getByLabel(dailyCopy['form.birth.precise'], { exact: true }).check();
    await page.getByLabel(dailyCopy['form.birth.time'], { exact: true }).fill('08:30');
    await page.getByRole('button', { name: dailyCopy['form.birth.next'], exact: true }).click();
    await page.getByLabel(dailyCopy['form.birth.city'], { exact: true }).fill('Beijing');
    await page.getByRole('option').filter({ hasText: 'Asia/Shanghai' }).first().click();
    await page.getByRole('button', { name: dailyCopy['form.birth.save'], exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`/${otherLocale}/me$`));
    await page.goto(`/${otherLocale}/today`);
    await page.getByRole('button', { name: dailyCopy['daily.cardFlip'], exact: true }).click();
    const daily = page.locator('.daily-card-face');
    await expect(daily.locator('img')).toHaveAttribute('src', /\/tarot\/rws\/.+\.webp$/);
    const dailyKey = await daily.locator('img').getAttribute('src');
    const dailyOrientation = await daily.locator('h3').textContent();
    await page.reload();
    await page.getByRole('button', { name: dailyCopy['daily.cardFlip'], exact: true }).click();
    await expect(daily.locator('img')).toHaveAttribute('src', dailyKey!);
    await expect(daily.locator('h3')).toHaveText(dailyOrientation!);
    expect(errors).toEqual([]);
  });
}
