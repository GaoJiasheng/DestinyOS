import { testDatabaseUrl, sqliteClient } from '../../../scripts/sqlite-test';
import { test, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { Temporal } from '@js-temporal/polyfill';
import { BirthInputSchema } from '@tianji/shared';
import { encryptField, decryptField } from '../lib/crypto';
import A from '../../../packages/engine/test/fixtures/birth/A.json' with { type: 'json' };
import zh from '../messages/zh.json' with { type: 'json' };
import en from '../messages/en.json' with { type: 'json' };
const birth = BirthInputSchema.parse(A);
const db = sqliteClient(testDatabaseUrl(57532));
process.env.FIELD_ENCRYPTION_KEYS = `v1:${Buffer.alloc(32, 1).toString('base64')}`;
test.afterAll(async () => {
  await db.$disconnect();
});
for (const locale of ['zh', 'en'] as const) {
  const copy = locale === 'zh' ? zh : en;
  test(`${locale}: daily mood → encrypted journal → month/list Mirror → JSON export → account deletion`, async ({
    page,
    request,
  }) => {
    await page.addInitScript(() => localStorage.setItem('tianji-disclaimer-v1', 'accepted'));
    await page.goto(`/${locale}/me/journal`);
    await expect(
      page.getByRole('link', { name: copy['journal.login'], exact: true }),
    ).toBeVisible();
    const email = `journal-${randomUUID()}@example.com`;
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
    await page.goto(`/${locale}/me/journal`);
    await expect(
      page.getByRole('link', { name: copy['daily.profileCTA'], exact: true }),
    ).toBeVisible();
    const { place, gender, ...input } = birth;
    const profile = await db.birthProfile.create({
      data: {
        userId: user.id,
        isDefault: true,
        encBirth: encryptField(JSON.stringify(input), 'BirthProfile.encBirth', user.id),
        encPlace: encryptField(JSON.stringify(place), 'BirthProfile.encPlace', user.id),
        gender,
        timeUnknown: false,
        tz: 'Asia/Shanghai',
        birthYear: 1990,
        chartHash: 'journal-fixture',
      },
    });
    await db.user.update({ where: { id: user.id }, data: { tz: 'Asia/Shanghai' } });
    const today = Temporal.Now.instant().toZonedDateTimeISO('Asia/Shanghai').toPlainDate();
    const note = `A calm evening ${randomUUID()}`;
    await page.goto(`/${locale}/today?date=${today}`);
    const form = page.locator('[data-journal-form]');
    await expect(form.getByRole('radio')).toHaveCount(5);
    await expect(form.locator('legend')).toHaveText(copy['journal.mood']);
    await form.getByRole('radio', { name: copy['journal.mood.4'], exact: true }).check();
    await form.getByLabel(copy['journal.text']).fill(note);
    await form.getByRole('button', { name: copy['journal.save'], exact: true }).click();
    await expect(form.getByRole('status')).toHaveText(copy['journal.saved']);
    const row = await db.journalEntry.findFirstOrThrow({ where: { userId: user.id } });
    expect(row.text).toMatch(/^v1:/);
    expect(row.text).not.toContain(note);
    expect(decryptField(row.text, 'JournalEntry.text', user.id)).toBe(note);
    expect(() => decryptField(row.text, 'JournalEntry.text', 'other-owner')).toThrow();
    await page.reload();
    await expect(form.getByLabel(copy['journal.text'])).toHaveValue(note);
    await form.getByRole('radio', { name: copy['journal.mood.5'], exact: true }).check();
    await form.getByRole('button', { name: copy['journal.save'], exact: true }).click();
    await expect(form.getByRole('status')).toHaveText(copy['journal.saved']);
    expect(await db.journalEntry.count({ where: { userId: user.id } })).toBe(1);
    const revised = await db.journalEntry.findUniqueOrThrow({ where: { id: row.id } });
    expect(revised.prediction).toEqual(row.prediction);
    expect(revised.mood).toBe(5);
    for (const [offset, mood] of [
      [-2, 1],
      [-1, 3],
    ] as const) {
      await page.goto(`/${locale}/today?date=${today.add({ days: offset })}`);
      await form.getByRole('radio', { name: copy[`journal.mood.${mood}`], exact: true }).check();
      await form.getByRole('button', { name: copy['journal.save'], exact: true }).click();
      await expect(form.getByRole('status')).toHaveText(copy['journal.saved']);
    }
    await page.goto(`/${locale}/me/journal`);
    await expect(page.locator('[data-journal-day]')).toHaveCount(today.daysInMonth);
    await expect(page.locator(`[data-journal-day="${today}"]`)).toHaveClass(/journal-recorded/);
    await expect(page.locator('[data-journal-stats]')).toContainText(
      locale === 'zh' ? '3 天' : '3 days',
    );
    await page
      .locator('.settings-page')
      .screenshot({ path: `test-results/journal-month-${locale}-${test.info().project.name}.png` });
    await page.getByRole('button', { name: copy['journal.listView'], exact: true }).click();
    await expect(page.locator('[data-journal-entry]')).toHaveCount(Math.min(today.day, 3));
    await expect(page.getByText(note, { exact: true })).toBeVisible();
    await page.getByText(copy['journal.methodLabel'], { exact: true }).click();
    await expect(page.getByText(copy['journal.method'], { exact: true })).toBeVisible();
    await page
      .locator('.settings-page')
      .screenshot({ path: `test-results/journal-${locale}-${test.info().project.name}.png` });
    expect(await page.locator('body').evaluate((el) => el.scrollWidth <= window.innerWidth)).toBe(
      true,
    );
    const exported = (await (await page.request.get('/api/v1/me/export')).json()) as {
      data: { journalEntries: { text: string; profileId: string }[] };
    };
    expect(exported.data.journalEntries).toHaveLength(3);
    expect(exported.data.journalEntries.find((e) => e.text === note)?.profileId).toBe(profile.id);
    await page.goto(`/${locale}/me/settings`);
    await page.getByRole('button', { name: copy['me.delete'], exact: true }).click();
    await page.getByLabel(copy['me.deleteConfirm']).fill('DELETE');
    await page.getByRole('button', { name: copy['me.deleteFinal'], exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`/${locale}/auth/login`));
    expect(await db.journalEntry.count({ where: { userId: user.id } })).toBe(0);
  });
}
