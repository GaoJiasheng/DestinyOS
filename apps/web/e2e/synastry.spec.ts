import { testDatabaseUrl, sqliteClient } from '../../../scripts/sqlite-test';
import { test, expect } from '@playwright/test';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { TestCache } from '../../../scripts/test-cache';
import { encryptField } from '../lib/crypto';
import { BirthInputSchema } from '@tianji/shared';
import A from '../../../packages/engine/test/fixtures/birth/A.json' with { type: 'json' };
import B from '../../../packages/engine/test/fixtures/birth/B.json' with { type: 'json' };
import zh from '../messages/zh.json' with { type: 'json' };
import en from '../messages/en.json' with { type: 'json' };
const db = sqliteClient(testDatabaseUrl(57532));
process.env.FIELD_ENCRYPTION_KEYS = `v1:${Buffer.alloc(32, 1).toString('base64')}`;
const cache = new TestCache(testDatabaseUrl(57532));
test.afterAll(async () => {
  cache.disconnect();
  await db.$disconnect();
});
for (const locale of ['zh', 'en'] as const) {
  const t = locale === 'zh' ? zh : en;
  test(`${locale}: profiles → paired report → wheel modes → share → independent history → default and delete`, async ({
    page,
    request,
  }) => {
    await page.addInitScript(() => localStorage.setItem('tianji-disclaimer-v1', 'accepted'));
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'error' && /MISSING_MESSAGE|INVALID_MESSAGE/.test(message.text()))
        errors.push(message.text());
    });
    const user = await db.user.create({
      data: {
        email: `synastry-${randomUUID()}@example.com`,
        locale,
        disclaimerAcceptedAt: new Date(),
      },
    });
    await page.goto(`/${locale}/auth/login`);
    await page.getByLabel(t['auth.login.email']).fill(user.email!);
    await page.getByRole('button', { name: t['auth.login.send'], exact: true }).click();
    await expect(page.getByRole('status').filter({ hasText: user.email! })).toBeVisible();
    const outbox = (await (await request.get('http://127.0.0.1:60181/mail')).json()) as {
      to: string;
      text: string;
    }[];
    const link = outbox.find((mail) => mail.to === user.email)?.text.match(/http:\/\/[^\s]+/)?.[0];
    if (!link) throw new Error('Missing test mail');
    await page.goto(link);
    await page.getByRole('button', { name: t['auth.verify.confirm'], exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`/${locale}$`));
    async function profile(raw: unknown, label: string, isDefault: boolean) {
      const birth = BirthInputSchema.parse(raw),
        { place, gender, ...input } = birth;
      return db.birthProfile.create({
        data: {
          userId: user.id,
          version: 1,
          isDefault,
          label: encryptField(label, 'BirthProfile.label', user.id),
          encName: encryptField(label, 'BirthProfile.encName', user.id),
          encBirth: encryptField(JSON.stringify(input), 'BirthProfile.encBirth', user.id),
          encPlace: place
            ? encryptField(JSON.stringify(place), 'BirthProfile.encPlace', user.id)
            : null,
          gender,
          timeUnknown: birth.timeUnknown,
          tz: place?.tz ?? 'UTC',
          birthYear: birth.year,
          chartHash: randomUUID(),
        },
      });
    }
    const first = await profile(A, 'Alpha', true),
      second = await profile(B, 'Beta', false);
    try {
      await page.goto(`/${locale}/me/profiles`);
      await expect(page.getByRole('heading', { name: 'Alpha', exact: true })).toBeVisible();
      await page.getByRole('button', { name: t['profiles.add'], exact: true }).click();
      await page.getByLabel(t['form.birth.year'], { exact: true }).fill('1992');
      await page.getByRole('button', { name: t['form.birth.next'], exact: true }).click();
      await page.getByLabel(t['form.birth.displayName'], { exact: true }).fill('Gamma');
      await page.getByRole('button', { name: t['profiles.save'], exact: true }).click();
      await expect(page.getByRole('heading', { name: 'Gamma', exact: true })).toBeVisible();
      await expect(
        page.getByRole('button', { name: t['profiles.add'], exact: true }),
      ).toBeDisabled();
      const stored = await db.birthProfile.findMany({ where: { userId: user.id } });
      expect(stored).toHaveLength(3);
      expect(stored.every((p) => p.label?.startsWith('v1:'))).toBe(true);
      await page.goto(`/${locale}/today`);
      await expect
        .poll(async () => (await cache.keys(`daily:${user.id}:${first.id}:1:*`)).length)
        .toBeGreaterThan(0);
      await page.goto(`/${locale}/synastry`);
      await page.getByLabel(t['synastry.a'], { exact: true }).selectOption(first.id);
      await page.getByLabel(t['synastry.b'], { exact: true }).selectOption(second.id);
      await page.getByRole('button', { name: t['synastry.submit'], exact: true }).click();
      await expect(page).toHaveURL(new RegExp(`/${locale}/synastry/r/`));
      await expect(
        page.getByRole('heading', { name: t['synastry.guna'], exact: true }),
      ).toBeVisible();
      await expect(
        page
          .locator('.synastry-chart table')
          .filter({ hasText: t['synastry.koota.nadi'] })
          .locator('tbody tr'),
      ).toHaveCount(8);
      await page.getByRole('button', { name: t['synastry.sideBySide'], exact: true }).click();
      await expect(page.locator('.synastry-pair').first().locator('svg')).toHaveCount(2);
      if (test.info().project.name === 'desktop')
        expect(
          await page
            .locator('.synastry-pair')
            .first()
            .locator('svg')
            .first()
            .evaluate((wheel) => wheel.getBoundingClientRect().width),
        ).toBeGreaterThanOrEqual(280);
      await page.getByRole('button', { name: t['synastry.overlay'], exact: true }).click();
      await expect(page.getByRole('img', { name: t['synastry.wheel'], exact: true })).toBeVisible();
      await page
        .getByRole('img', { name: t['synastry.wheel'], exact: true })
        .screenshot({ path: test.info().outputPath('synastry-wheel.png') });
      if (test.info().project.name === 'mobile')
        await expect
          .poll(() => page.evaluate(() => document.documentElement.scrollWidth))
          .toBeLessThanOrEqual(page.viewportSize()!.width + 1);
      const readingId = page.url().split('/').at(-1)!;
      const row = await db.reading.findUniqueOrThrow({ where: { id: readingId } });
      expect(row.profileId).toBe(first.id);
      expect(row.partnerProfileId).toBe(second.id);
      expect(row.encInput).toMatch(/^v1:/);
      // Legacy imports have no profile association and must survive the new history filter.
      const legacy = await db.reading.create({
        data: {
          userId: user.id,
          system: row.system,
          encInput: row.encInput,
          chart: row.chart as Prisma.InputJsonObject,
          schoolUsed: row.schoolUsed as Prisma.InputJsonObject,
          reportZh: row.reportZh ? (row.reportZh as Prisma.InputJsonObject) : Prisma.DbNull,
          reportEn: row.reportEn ? (row.reportEn as Prisma.InputJsonObject) : Prisma.DbNull,
          engineVersion: row.engineVersion,
          interpretVersion: row.interpretVersion,
          knowledgeVersion: row.knowledgeVersion,
        },
      });
      await page.getByRole('button', { name: t['report.share'], exact: true }).click();
      await page.getByLabel(t['share.template'], { exact: true }).selectOption('synastry');
      await page.getByRole('button', { name: t['share.generate'], exact: true }).click();
      await expect(page.getByRole('img', { name: t['share.preview'], exact: true })).toBeVisible();
      await expect
        .poll(async () =>
          page
            .getByRole('img', { name: t['share.preview'], exact: true })
            .evaluate(
              (image) =>
                image instanceof HTMLImageElement && image.complete && image.naturalWidth > 0,
            ),
        )
        .toBe(true);
      await page
        .getByRole('img', { name: t['share.preview'], exact: true })
        .screenshot({ path: test.info().outputPath('synastry-card.png') });
      const share = await db.shareLink.findFirstOrThrow({ where: { readingId } });
      expect(share.template).toBe('synastry');
      await page.goto(`/s/${share.token}?locale=${locale}`);
      await expect(page.locator('body')).not.toContainText('Alpha');
      await expect(page.locator('body')).not.toContainText('Beta');
      await page.goto(`/${locale}/me/profiles`);
      const beta = page
        .locator('li')
        .filter({ has: page.getByRole('heading', { name: 'Beta', exact: true }) });
      await page.getByRole('button', { name: t['profiles.switch'], exact: true }).click();
      await page.getByRole('dialog').getByRole('button', { name: 'Beta', exact: true }).click();
      await expect(page.getByRole('dialog')).toHaveCount(0);
      await page.goto(`/${locale}/bazi/new`);
      await expect(page.getByLabel(t['form.birth.year'], { exact: true })).toHaveValue(
        String(B.year),
      );
      await page.goto(`/${locale}/today`);
      await expect
        .poll(async () => (await cache.keys(`daily:${user.id}:${second.id}:1:*`)).length)
        .toBeGreaterThan(0);
      await page.goto(`/${locale}/me/history`);
      await expect(
        page.locator(`a[href="/${locale}/synastry/r/${readingId}"]`).filter({ visible: true }),
      ).toBeVisible();
      await expect(
        page.locator(`a[href="/${locale}/synastry/r/${legacy.id}"]`).filter({ visible: true }),
      ).toBeVisible();
      await page.goto(`/${locale}/me/profiles`);
      await beta.getByRole('button', { name: t['profiles.edit'], exact: true }).click();
      await page.getByRole('button', { name: t['form.birth.next'], exact: true }).click();
      await page.getByRole('button', { name: t['profiles.save'], exact: true }).click();
      await expect(page.getByRole('button', { name: t['profiles.save'], exact: true })).toHaveCount(
        0,
      );
      await page.goto(`/${locale}/synastry/r/${readingId}`);
      await expect(
        page.getByRole('main').getByText(t['report.stale'], { exact: true }),
      ).toBeVisible();
      await page.goto(`/${locale}/me/profiles`);
      await beta.getByRole('button', { name: t['profiles.setDefault'], exact: true }).click();
      await expect(beta).toContainText(t['profiles.default']);
      await beta.getByRole('button', { name: t['profiles.delete'], exact: true }).click();
      await page
        .getByRole('dialog')
        .getByRole('button', { name: t['profiles.delete'], exact: true })
        .click();
      await expect(page.getByRole('dialog')).toHaveCount(0);
      await expect(page.getByRole('heading', { name: 'Beta', exact: true })).toHaveCount(0);
      expect(await db.reading.count({ where: { id: readingId } })).toBe(0);
      expect(await db.reading.count({ where: { id: legacy.id } })).toBe(1);
      expect(await db.shareLink.count({ where: { token: share.token } })).toBe(0);
      expect(await db.birthProfile.count({ where: { userId: user.id, isDefault: true } })).toBe(1);
      expect(errors).toEqual([]);
    } finally {
      await db.user.delete({ where: { id: user.id } });
    }
  });
}
