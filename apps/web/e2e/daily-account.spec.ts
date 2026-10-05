import { test, expect, type Page, type APIRequestContext } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { writeFile, mkdir } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { encryptField } from '../lib/crypto';
import { generateReading } from '../lib/reading-service';
import { json } from '../lib/reading-service';
import { BirthInputSchema, brand } from '@tianji/shared';
import zh from '../messages/zh.json';
import en from '../messages/en.json';
import Redis from 'ioredis';
const db = new PrismaClient({
    datasourceUrl:
      'postgresql://postgres:postgres@127.0.0.1:57532/postgres?connection_limit=1&statement_cache_size=0',
  }),
  cache = new Redis('redis://127.0.0.1:58479', { lazyConnect: true });
process.env.FIELD_ENCRYPTION_KEYS = `v1:${Buffer.alloc(32, 1).toString('base64')}`;
const birth = BirthInputSchema.parse({
  calendar: 'gregorian',
  year: 1990,
  month: 5,
  day: 15,
  hour: 8,
  minute: 30,
  timeUnknown: false,
  gender: 'male',
  place: { name: 'Beijing', lat: 39.9, lng: 116.4, tz: 'Asia/Shanghai' },
});
test.afterAll(async () => {
  await db.$disconnect();
  cache.disconnect();
});
async function login(page: Page, request: APIRequestContext, locale: 'zh' | 'en') {
  const copy = locale === 'zh' ? zh : en,
    email = `daily-${locale}-${randomUUID()}@example.com`;
  await page.goto(`/${locale}/auth/login`);
  await page.getByLabel(copy['auth.login.email']).fill(email);
  await page.getByRole('button', { name: copy['auth.login.send'], exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: email })).toBeVisible();
  const outbox = (await (await request.get('http://127.0.0.1:60181/mail')).json()) as {
      to: string;
      text: string;
    }[],
    link = outbox.find((m) => m.to === email)?.text.match(/http:\/\/[^\s]+/)?.[0];
  if (!link) throw new Error('Missing test mail');
  await page.goto(link);
  await page.getByRole('button', { name: copy['auth.verify.confirm'], exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/${locale}$`));
  return db.user.findUniqueOrThrow({ where: { email } });
}
async function seed(userId: string, locale: 'zh' | 'en') {
  const { place, gender, ...input } = birth;
  const profile = await db.birthProfile.create({
    data: {
      userId,
      encBirth: encryptField(JSON.stringify(input), 'BirthProfile.encBirth', userId),
      encPlace: encryptField(JSON.stringify(place), 'BirthProfile.encPlace', userId),
      gender,
      timeUnknown: false,
      tz: 'Asia/Shanghai',
      birthYear: 1990,
      chartHash: 'test-profile',
    },
  });
  const req = { system: 'bazi' as const, locale, birth, idempotencyKey: randomUUID() };
  const result = await generateReading(req, '2026-10-04T00:00:00Z');
  return db.reading.create({
    data: {
      userId,
      profileId: profile.id,
      profileVersion: 1,
      encInput: encryptField(JSON.stringify(req), 'Reading.encInput', userId),
      system: 'bazi',
      chart: json(result.chart),
      reportZh: locale === 'zh' ? json(result.report) : undefined,
      reportEn: locale === 'en' ? json(result.report) : undefined,
      schoolUsed: json(result.meta.schoolUsed),
      engineVersion: result.report.engineVersion,
      knowledgeVersion: result.report.knowledgeVersion,
      interpretVersion: result.report.interpretVersion,
      title: 'Fixture reflection',
    },
  });
}
for (const locale of ['zh', 'en'] as const) {
  const copy = locale === 'zh' ? zh : en;
  test(`${locale}: anonymous example, offline local today, date gesture and encyclopedia SEO`, async ({
    page,
    request,
  }, info) => {
    await page.addInitScript(() => localStorage.setItem('tianji-disclaimer-v1', 'accepted'));
    await page.goto(`/${locale}/today`);
    await expect(page.getByText(copy['daily.example'], { exact: true })).toBeVisible();
    await expect(page.locator('[data-daily-block]')).toHaveCount(13);
    // Inject a profile using the real encrypted device envelope through an actual form flow.
    await page.goto(`/${locale}/me/birth`);
    await page.getByLabel(copy['form.birth.year'], { exact: true }).fill('1990');
    await page.getByLabel(copy['form.birth.month'], { exact: true }).fill('5');
    await page.getByLabel(copy['form.birth.day'], { exact: true }).fill('15');
    await page.getByLabel(copy['form.birth.precise'], { exact: true }).check();
    await page.getByLabel(copy['form.birth.time'], { exact: true }).fill('08:30');
    await page.getByRole('button', { name: copy['form.birth.next'], exact: true }).click();
    await page.getByLabel(copy['form.birth.city'], { exact: true }).fill('Beijing');
    await page.getByRole('option').filter({ hasText: 'Asia/Shanghai' }).first().click();
    await page.getByRole('button', { name: copy['form.birth.save'], exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`/${locale}/me$`));
    const before = await db.reading.count();
    await page.goto(`/${locale}/today`);
    await expect(page.getByText(copy['daily.example'], { exact: true })).toHaveCount(0);
    await expect(page.locator('[data-daily-block="10"] li')).toHaveCount(6);
    expect(await db.reading.count()).toBe(before);
    const today = await page.locator('header time').getAttribute('datetime');
    await page.getByRole('button', { name: copy['daily.tomorrow'], exact: true }).click();
    await expect(page.locator('header time')).not.toHaveAttribute('datetime', today!);
    await page
      .locator('.daily-page')
      .dispatchEvent('touchstart', { touches: [{ identifier: 1, clientX: 80, clientY: 160 }] });
    await page.locator('.daily-page').dispatchEvent('touchend', {
      changedTouches: [{ identifier: 1, clientX: 240, clientY: 165 }],
    });
    await expect(page.locator('header time')).toHaveAttribute('datetime', today!);
    await page.getByRole('button', { name: copy['daily.cardFlip'], exact: true }).click();
    await expect(page.locator('.daily-card-face')).toBeVisible();
    await expect(page.locator('.daily-card-face h3')).not.toContainText('tarot.card.');
    await page.locator('.daily-card-face').evaluate(async (element) => {
      await Promise.all(element.getAnimations().map((animation) => animation.finished));
    });
    await page.screenshot({
      path: `test-results/today-${locale}-${info.project.name}.png`,
      fullPage: true,
    });
    await page.goto(`/${locale}/learn/tarot/major_00_fool`);
    await expect(page.locator('h1')).toHaveText(locale === 'zh' ? '愚人' : 'The Fool');
    await expect(page.locator('link[rel="alternate"][hreflang="en"]')).toHaveAttribute(
      'href',
      /\/en\/learn\/tarot\/major_00_fool/,
    );
    expect(await page.locator('script[type="application/ld+json"]').textContent()).toContain(
      'Article',
    );
    const sitemap = await (await request.get('/sitemap.xml')).text();
    expect(sitemap).toContain('/learn/iching/hexagram_64');
    expect(sitemap).not.toContain('/me/settings');
  });
  test(`${locale}: cached daily → three share templates → export → delete → cron hard delete`, async ({
    page,
    request,
  }, info) => {
    await page.addInitScript(() => localStorage.setItem('tianji-disclaimer-v1', 'accepted'));
    const user = await login(page, request, locale),
      reading = await seed(user.id, locale);
    await page.goto(`/${locale}/today`);
    await expect(page.locator('[data-daily-block="10"] li')).toHaveCount(6);
    const expectedDont = await page.locator('[data-daily-block="10"] li').last().textContent();
    const keys = await cache.keys(
      `daily:${user.id}:${reading.profileId}:${reading.profileVersion}:*:${locale}:*`,
    );
    expect(keys).toHaveLength(1);
    expect(await cache.ttl(keys[0]!)).toBeGreaterThan(0);
    await page.getByRole('button', { name: copy['report.share'], exact: true }).click();
    await page.getByRole('button', { name: copy['share.generate'], exact: true }).click();
    await expect(page.getByAltText(copy['share.preview'])).toBeVisible();
    const dailyImage = await page.locator('a[download="tianji.png"]').getAttribute('href');
    expect(dailyImage).toMatch(/^blob:/);
    await page.getByRole('button', { name: copy['common.close'], exact: true }).click();
    await page.goto(`/${locale}/bazi/r/${reading.id}`);
    await page.getByRole('button', { name: copy['report.share'], exact: true }).click();
    const dialog = page.getByRole('dialog');
    for (const template of ['chart', 'quote', 'daily']) {
      await dialog.getByLabel(copy['share.template'], { exact: true }).selectOption(template);
      await dialog.getByRole('button', { name: copy['share.generate'], exact: true }).click();
      await expect(dialog.getByAltText(copy['share.preview'])).toBeVisible();
      if (template === 'chart') {
        for (const level of [1, 2]) {
          await dialog
            .getByLabel(copy['share.reveal'], { exact: true })
            .selectOption(String(level));
          await dialog.getByRole('button', { name: copy['share.generate'], exact: true }).click();
          await expect(dialog.getByAltText(copy['share.preview'])).toBeVisible();
          const shared = await db.shareLink.findFirstOrThrow({
            where: { userId: user.id },
            orderBy: { createdAt: 'desc' },
          });
          expect(shared.revealLevel).toBe(level);
          const body = await (await request.get(`/s/${shared.token}?locale=${locale}`)).text();
          expect(body).toContain(copy['share.diagram']);
          expect(body).not.toMatch(/1990-05-15|1990年5月15日|08:30|Beijing|encInput/);
        }
        await dialog.getByLabel(copy['share.reveal'], { exact: true }).selectOption('0');
      }
    }
    const link = await db.shareLink.findFirstOrThrow({
        where: { userId: user.id },
        orderBy: { createdAt: 'desc' },
      }),
      publicPage = await request.get(`/s/${link.token}?locale=${locale}`),
      html = await publicPage.text();
    expect(html).not.toMatch(/1990-05-15|1990年5月15日|08:30|Beijing|encInput/);
    expect(html).toContain('noindex');
    expect(html).toContain(`lang="${locale}"`);
    expect(html).toContain(`locale=${locale}`);
    const png = await request.get(`/api/v1/og/share/${link.token}?locale=${locale}`);
    expect(png.ok()).toBe(true);
    expect(png.headers()['content-type']).toContain('image/png');
    const buffer = await png.body();
    expect(buffer.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
    expect([buffer.readUInt32BE(16), buffer.readUInt32BE(20)]).toEqual([1200, 630]);
    const story = await (
      await request.get(`/api/v1/og/share/${link.token}?format=story&locale=${locale}`)
    ).body();
    expect([story.readUInt32BE(16), story.readUInt32BE(20)]).toEqual([1080, 1920]);
    await mkdir('test-results', { recursive: true });
    const pngPath = `test-results/share-${locale}-${info.project.name}.png`;
    await writeFile(pngPath, buffer);
    if (process.platform === 'darwin') {
      const { stdout } = await promisify(execFile)(
        'swift',
        ['scripts/share-image-ocr.swift', pngPath],
        { timeout: 60000 },
      );
      expect(stdout).not.toMatch(/1990|05[-/]15|08:30|Beijing/);
      if (locale === 'en') {
        // DESIGN-GAP: Cinzel small capitals are correctly read as uppercase by OCR; compare brand letters without casing while keeping the PII and complete advice assertions strict.
        expect(stdout.toLowerCase()).toContain(brand.nameEn.toLowerCase());
        expect(stdout.replace(/\s+/g, ' ').toLowerCase()).toContain(expectedDont!.toLowerCase());
      }
    }
    const visitorContext = await page.context().browser()!.newContext();
    const visitor = await visitorContext.newPage();
    await visitor.goto(`http://localhost:3210/${locale}/bazi/r/${reading.id}`);
    await expect(
      visitor.getByText(copy['report.error.E_FORBIDDEN'], { exact: true }),
    ).toBeVisible();
    await visitorContext.close();
    const exported = await page.request.get('/api/v1/me/export');
    expect(exported.ok()).toBe(true);
    expect(exported.headers()['content-disposition']).toContain('attachment');
    const data = (await exported.json()) as { data: { profiles: { birth: { year: number } }[] } };
    expect(data.data.profiles[0]?.birth.year).toBe(1990);
    expect((await page.request.get('/api/v1/me/export')).status()).toBe(429);
    await page.getByRole('button', { name: copy['common.close'], exact: true }).click();
    await page.goto(`/${locale}/me/settings`);
    await page
      .locator('form')
      .getByLabel(copy['me.language'], { exact: true })
      .selectOption(locale);
    await page.getByLabel(copy['me.motion'], { exact: true }).check();
    await page.getByLabel(copy['me.sound'], { exact: true }).check();
    await page.getByLabel(copy['me.tz'], { exact: true }).fill('Asia/Singapore');
    await page.getByRole('button', { name: copy['me.save'], exact: true }).click();
    await expect(page.getByRole('status').filter({ hasText: copy['me.saved'] })).toBeVisible();
    expect((await db.user.findUniqueOrThrow({ where: { id: user.id } })).reducedMotion).toBe(true);
    await page.getByRole('button', { name: copy['me.delete'], exact: true }).click();
    await page.getByLabel(copy['me.deleteConfirm'], { exact: true }).fill('WRONG');
    await expect(
      page.getByRole('button', { name: copy['me.deleteFinal'], exact: true }),
    ).toBeDisabled();
    await page.getByLabel(copy['me.deleteConfirm'], { exact: true }).fill('DELETE');
    await page.getByRole('button', { name: copy['me.deleteFinal'], exact: true }).click();
    await expect(page).toHaveURL(/auth\/login\?deleted=1/);
    expect((await db.user.findUniqueOrThrow({ where: { id: user.id } })).deletedAt).not.toBeNull();
    expect(await db.session.count({ where: { userId: user.id } })).toBe(0);
    expect((await request.get(`/s/${link.token}`)).status()).toBe(404);
    expect((await request.get(`/api/v1/og/share/${link.token}`)).status()).toBe(404);
    expect((await request.get('/api/v1/me/export')).status()).toBe(401);
    expect((await request.post('/api/v1/cron/daily-maintenance')).status()).toBe(401);
    const first = await request.post('/api/v1/cron/daily-maintenance', {
      headers: { Authorization: 'Bearer isolated-cron-secret' },
    });
    expect(first.ok()).toBe(true);
    expect(await db.user.findUnique({ where: { id: user.id } })).not.toBeNull();
    await db.user.update({
      where: { id: user.id },
      data: { deletedAt: new Date(Date.now() - 8 * 86400000) },
    });
    expect(
      (
        await request.post('/api/v1/cron/daily-maintenance', {
          headers: { Authorization: 'Bearer isolated-cron-secret' },
        })
      ).ok(),
    ).toBe(true);
    expect(await db.user.findUnique({ where: { id: user.id } })).toBeNull();
    expect(await db.reading.count({ where: { userId: user.id } })).toBe(0);
    await page.screenshot({ path: `test-results/deleted-${locale}-${info.project.name}.png` });
  });
}
