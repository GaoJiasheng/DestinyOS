import { test, expect } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';
import { randomUUID } from 'node:crypto';
import { encryptField } from '../lib/crypto';
import { encryptAnonymous } from '../lib/anonymous-storage';
import { BirthInputSchema } from '@tianji/shared';
import A from '../../../packages/engine/test/fixtures/birth/A.json';
import zh from '../messages/zh.json';
import en from '../messages/en.json';
import tw from '../messages/zh-TW.json';
const birth = BirthInputSchema.parse(A);
const db = new PrismaClient({
  datasourceUrl:
    'postgresql://postgres:postgres@127.0.0.1:57532/postgres?connection_limit=1&statement_cache_size=0',
});
const redis = new Redis('redis://127.0.0.1:58479', { lazyConnect: true });
process.env.FIELD_ENCRYPTION_KEYS = `v1:${Buffer.alloc(32, 1).toString('base64')}`;
test.afterAll(async () => {
  await db.$disconnect();
  redis.disconnect();
});
for (const locale of ['zh', 'en', 'zh-TW'] as const) {
  const copy = locale === 'zh-TW' ? tw : locale === 'zh' ? zh : en;
  test(`${locale}: owner calendar, yearly cache, month navigation and dated daily report`, async ({
    page,
    request,
  }) => {
    await page.clock.setFixedTime(new Date('2026-10-05T04:00:00Z'));
    await page.addInitScript(() => localStorage.setItem('tianji-disclaimer-v1', 'accepted'));
    const email = `calendar-${randomUUID()}@example.com`;
    await page.goto(`/${locale}/auth/login`);
    await page.getByLabel(copy['auth.login.email']).fill(email);
    await page.getByRole('button', { name: copy['auth.login.send'], exact: true }).click();
    await expect(page.getByRole('status').filter({ hasText: email })).toBeVisible();
    const mail = (await (await request.get('http://127.0.0.1:60181/mail')).json()) as {
      to: string;
      text: string;
    }[];
    const link = mail.find((m) => m.to === email)?.text.match(/http:\/\/[^\s]+/)?.[0];
    if (!link) throw new Error('Missing login mail');
    await page.goto(link);
    await page.getByRole('button', { name: copy['auth.verify.confirm'], exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`/${locale}$`));
    const user = await db.user.findUniqueOrThrow({ where: { email } });
    await page.goto(`/${locale}/today/calendar`);
    await expect(page.getByText(copy['calendar.profileRequired'], { exact: false })).toBeVisible();
    const { place, gender, ...input } = birth;
    await db.birthProfile.create({
      data: {
        userId: user.id,
        encBirth: encryptField(JSON.stringify(input), 'BirthProfile.encBirth', user.id),
        encPlace: encryptField(JSON.stringify(place), 'BirthProfile.encPlace', user.id),
        gender,
        timeUnknown: false,
        tz: 'Asia/Shanghai',
        birthYear: 1990,
        chartHash: 'calendar-fixture',
      },
    });
    await page.reload();
    await expect(page.locator('[data-calendar-day]')).toHaveCount(31);
    await expect(page.locator('[data-calendar-event="solar_term"]')).toHaveCount(24);
    const keys = await redis.keys(`calendar:${user.id}:*:1:*`);
    expect(keys).toHaveLength(1);
    expect(await redis.ttl(keys[0]!)).toBeGreaterThan(0);
    await page.getByRole('button', { name: copy['calendar.next'], exact: true }).click();
    await expect(page.locator('[data-calendar-day]')).toHaveCount(30);
    expect(await redis.keys(`calendar:${user.id}:*:1:*`)).toHaveLength(1);
    await page.getByRole('button', { name: copy['calendar.next'], exact: true }).click();
    await expect(page.locator('[data-calendar-day]').first()).toHaveAttribute(
      'data-calendar-day',
      /-12-01$/,
    );
    await page.getByRole('button', { name: copy['calendar.next'], exact: true }).click();
    await expect(page.locator('[data-calendar-day]').first()).toHaveAttribute(
      'data-calendar-day',
      /-01-01$/,
    );
    await expect(page.locator('[data-calendar-event="solar_term"]')).toHaveCount(24);
    expect(await redis.keys(`calendar:${user.id}:*:1:*`)).toHaveLength(2);
    const selected = page.locator('[data-calendar-day]').first();
    const date = await selected.getAttribute('data-calendar-day');
    const label = await selected.getAttribute('aria-label');
    const score = await selected.locator('text').last().textContent();
    expect(label).toContain(score);
    await selected.click();
    await expect(page).toHaveURL(new RegExp(`/today[?]date=${date}`));
    await expect(page.locator('[data-daily-block="1"] time')).toHaveAttribute('datetime', date!);
    await expect(page.locator('[data-daily-block="3"]')).toBeVisible();
    await page.getByRole('link', { name: copy['calendar.title'], exact: true }).click();
    await expect(page.locator('[data-calendar-event="solar_return"]')).toHaveCount(1);
    await page
      .locator('.calendar-page .report-card')
      .first()
      .screenshot({
        path: `test-results/calendar-${locale}-${test.info().project.name}.png`,
      });
    await page.locator('[data-calendar-event="solar_return"] a').click();
    await expect(page.locator('[data-daily-block="1"] time')).toHaveAttribute(
      'datetime',
      /\d{4}-05-\d{2}/,
    );
  });
  test(`${locale}: anonymous profile stays local, missing-profile state and keyboard day link`, async ({
    page,
  }) => {
    await page.clock.setFixedTime(new Date('2026-10-05T04:00:00Z'));
    await page.addInitScript(() => localStorage.setItem('tianji-disclaimer-v1', 'accepted'));
    await page.goto(`/${locale}/today/calendar`);
    await expect(page.getByText(copy['calendar.profileRequired'], { exact: false })).toBeVisible();
    const payload = await encryptAnonymous({
      anonId: randomUUID(),
      profile: { ...birth, timeUnknown: true },
      readings: [],
      settings: {},
    });
    await page.evaluate((value) => localStorage.setItem('tianji.anon', value), payload);
    const births: string[] = [];
    page.on('request', (req) => {
      if (req.postData()?.includes('1990')) births.push(req.url());
    });
    await page.reload();
    await expect(page.locator('[data-calendar-day]')).toHaveCount(31);
    await expect(page.getByText(copy['calendar.unknownTime'], { exact: true })).toBeVisible();
    await expect(page.locator('[data-calendar-event="ziwei_year"]')).toHaveCount(0);
    const first = page.locator('[data-calendar-day]').first(),
      date = await first.getAttribute('data-calendar-day');
    await first.focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('[data-daily-block="1"] time')).toHaveAttribute('datetime', date!);
    expect(births).toEqual([]);
    expect(await page.locator('body').evaluate((el) => el.scrollWidth <= window.innerWidth)).toBe(
      true,
    );
  });
}
