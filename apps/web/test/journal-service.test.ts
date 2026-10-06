import { isolatedSqlite } from '../../../scripts/sqlite-test';
import { beforeAll, afterAll, expect, it, vi } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { BirthInputSchema } from '@tianji/shared';
import { Temporal } from '@js-temporal/polyfill';
import { createHash } from 'node:crypto';
import { normalizeBirth, computeBazi, computeAstrology, computeDaily } from '@tianji/engine';
import A from '../../../packages/engine/test/fixtures/birth/A.json';
import { fieldEncryptionExtension } from '../lib/db-encryption';
import { decryptField, encryptField } from '../lib/crypto';
import { rotateKeys } from '../../../scripts/rotate-keys';
const state = vi.hoisted(() => ({ db: undefined as unknown, auth: vi.fn() }));
vi.mock('../lib/db', () => ({ getDb: () => state.db }));
vi.mock('../lib/auth', () => ({ auth: state.auth }));
vi.mock('../lib/ratelimit', () => ({
  ratelimit: async () => ({ success: true }),
  assertRateLimit: () => undefined,
}));
vi.mock('next/headers', () => ({ cookies: async () => ({ get: () => undefined }) }));
import { journalEntryForUser, journalMonthForUser, saveJournalEntry } from '../lib/journal-service';
import { exportAccount, softDeleteAccount } from '../lib/account-service';
import {
  getJournalEntryAction,
  getJournalMonthAction,
  saveJournalEntryAction,
} from '../app/me/journal/actions';
const pg = isolatedSqlite();
let raw: PrismaClient;
function extend(client: PrismaClient) {
  return client.$extends(fieldEncryptionExtension());
}
let db: ReturnType<typeof extend>;
const birth = BirthInputSchema.parse(A),
  { place, gender, ...input } = birth;
let owner: string, other: string, profileId: string, secondProfileId: string;
const today = Temporal.Now.instant()
  .toZonedDateTimeISO('America/New_York')
  .toPlainDate()
  .toString();
beforeAll(async () => {
  vi.stubEnv('FIELD_ENCRYPTION_KEYS', `v1:${Buffer.alloc(32, 1).toString('base64')}`);
  raw = pg.client;
  db = extend(raw);
  state.db = db;
  owner = (await db.user.create({ data: { email: 'journal-owner@example.test' } })).id;
  other = (await db.user.create({ data: { email: 'journal-other@example.test' } })).id;
  const data = {
    userId: owner,
    encBirth: JSON.stringify(input),
    encPlace: JSON.stringify(place),
    gender,
    timeUnknown: false,
    tz: 'Asia/Shanghai',
    birthYear: 1990,
    chartHash: 'test',
  };
  profileId = (await db.birthProfile.create({ data })).id;
  secondProfileId = (await db.birthProfile.create({ data })).id;
}, 30000);
afterAll(async () => {
  await raw?.$disconnect();
  await pg.close();
  vi.unstubAllEnvs();
});
it('rejects forged users/profiles, invalid dates, anonymous actions and future diary writes before persistence', async () => {
  const entry = { profileId, date: today, mood: 4, text: 'private event', tz: 'America/New_York' };
  await expect(saveJournalEntry(other, entry, 'en')).rejects.toMatchObject({ code: 'E_FORBIDDEN' });
  await expect(
    saveJournalEntry(
      owner,
      { ...entry, date: Temporal.PlainDate.from(today).add({ days: 1 }).toString() },
      'en',
    ),
  ).rejects.toMatchObject({ code: 'E_DATE_OUT_OF_RANGE' });
  state.auth.mockResolvedValue(null);
  expect(await getJournalEntryAction({ profileId, date: today })).toMatchObject({
    ok: false,
    error: { code: 'E_UNAUTHORIZED' },
  });
  expect(
    await getJournalMonthAction({ profileId, month: today.slice(0, 7), tz: 'UTC', locale: 'en' }),
  ).toMatchObject({ ok: false, error: { code: 'E_UNAUTHORIZED' } });
  expect(await saveJournalEntryAction(entry, 'en')).toMatchObject({
    ok: false,
    error: { code: 'E_UNAUTHORIZED' },
  });
  state.auth.mockResolvedValue({ user: { id: owner } });
  expect(await saveJournalEntryAction({ ...entry, userId: other }, 'en')).toMatchObject({
    ok: false,
    error: { code: 'E_VALIDATION' },
  });
  expect(await db.journalEntry.count()).toBe(0);
});
it('encrypts at rest with AAD/owner isolation, preserves snapshot on edits, and uses the exact daily seed', async () => {
  const saved = await saveJournalEntry(
    owner,
    { profileId, date: today, mood: 4, text: '<script>private</script>', tz: 'America/New_York' },
    'en',
  );
  const normalized = normalizeBirth(birth, 'en');
  const now = Temporal.PlainDate.from(today)
    .toZonedDateTime({ timeZone: 'America/New_York', plainTime: '12:00' })
    .toInstant()
    .toString();
  const daily = computeDaily({
    birth: normalized,
    baziChart: computeBazi(normalized, { now }),
    astroChart: computeAstrology(normalized),
    vedicChart: null,
    date: { local: today, tz: 'America/New_York' },
    seed: createHash('sha256').update(`${owner}|${profileId}|${today}`).digest('hex'),
  });
  expect(saved.prediction.scores).toEqual(daily.scores);
  const stored = await raw.journalEntry.findUniqueOrThrow({ where: { id: saved.id } });
  expect(stored.text).toMatch(/^v1:/);
  expect(stored.text).not.toContain('private');
  expect(decryptField(stored.text, 'JournalEntry.text', owner)).toBe(saved.text);
  expect(() => decryptField(stored.text, 'JournalEntry.text', other)).toThrow();
  expect(() => decryptField(stored.text, 'ChatMessage.content', owner)).toThrow();
  await db.birthProfile.update({ where: { id: profileId, userId: owner }, data: { version: 2 } });
  const edited = await saveJournalEntry(
    owner,
    { profileId, date: today, mood: 5, text: 'edited note', tz: 'UTC' },
    'en',
  );
  expect(edited.id).toBe(saved.id);
  expect(edited.prediction).toEqual(saved.prediction);
  expect(await db.journalEntry.count({ where: { profileId } })).toBe(1);
  const month = await journalMonthForUser(
    owner,
    profileId,
    today.slice(0, 7),
    'America/New_York',
    'en',
  );
  expect(month.entries[0]?.mood).toBe(5);
  expect(month.stats.count).toBe(1);
  expect(month.days.find((day) => day.date === today)?.scores).toEqual(saved.prediction.scores);
  expect(
    (await journalMonthForUser(owner, secondProfileId, today.slice(0, 7), 'UTC', 'en')).entries,
  ).toEqual([]);
  await expect(journalEntryForUser(other, { profileId, date: today })).rejects.toMatchObject({
    code: 'E_FORBIDDEN',
  });
  await expect(db.journalEntry.findMany({ where: { text: 'edited note' } })).rejects.toThrow(
    'Encrypted text',
  );
  await expect(
    db.journalEntry.update({ where: { id: saved.id }, data: { text: 'unsafe' } }),
  ).rejects.toThrow('where.userId');
  const projection = await db.journalEntry.findUnique({
    where: { id: saved.id },
    select: { text: true },
  });
  expect(projection).toEqual({ text: 'edited note' });
  expect(
    await db.user.findUnique({
      where: { id: owner },
      select: { journalEntries: { select: { text: true } } },
    }),
  ).toEqual({ journalEntries: [{ text: 'edited note' }] });
});
it('rejects cross-owner database links, unencrypted writes, invalid moods and unsafe nested writes', async () => {
  const data = {
    userId: other,
    profileId,
    date: new Date('2026-01-01T00:00:00Z'),
    mood: 3,
    text: 'private',
    prediction: {},
  };
  // DESIGN-GAP: Direct PGlite SQL checks constraints without aborting the test socket's protocol session.
  const insert = (userId: string, mood: number, text: string) =>
    pg.query(
      'INSERT INTO "JournalEntry" ("id", "userId", "profileId", "date", "mood", "text", "prediction") VALUES ($1, $2, $3, $4, $5, $6, $7)',
      ['rejected-journal', userId, profileId, '2026-01-01', mood, text, '{}'],
    );
  await expect(
    insert(other, 3, encryptField('private', 'JournalEntry.text', other)),
  ).rejects.toMatchObject({ code: 'SQLITE_CONSTRAINT_FOREIGNKEY' });
  await expect(insert(owner, 3, 'plaintext')).rejects.toMatchObject({
    code: 'SQLITE_CONSTRAINT_TRIGGER',
  });
  await expect(
    insert(owner, 0, encryptField('private', 'JournalEntry.text', owner)),
  ).rejects.toMatchObject({ code: 'SQLITE_CONSTRAINT_TRIGGER' });
  await expect(
    db.user.update({
      where: { id: owner },
      data: {
        journalEntries: {
          create: { profileId, date: data.date, mood: 3, text: 'unsafe', prediction: {} },
        },
      },
    }),
  ).rejects.toThrow('nested');
});
it('rotates journal ciphertext, exports clear owner-only JSON and cascades profile/account deletion', async () => {
  const keys = `v2:${Buffer.alloc(32, 2).toString('base64')},v1:${Buffer.alloc(32, 1).toString('base64')}`;
  vi.stubEnv('FIELD_ENCRYPTION_KEYS', keys);
  await rotateKeys(raw);
  const stored = await raw.journalEntry.findFirstOrThrow({ where: { userId: owner } });
  expect(stored.text).toMatch(/^v2:/);
  const exported = await exportAccount(owner);
  expect(exported.journalEntries).toHaveLength(1);
  expect(exported.journalEntries[0]?.text).toBe('edited note');
  expect((await exportAccount(other)).journalEntries).toEqual([]);
  const removable = await saveJournalEntry(
    owner,
    { profileId: secondProfileId, date: today, mood: 3, text: '', tz: 'America/New_York' },
    'en',
  );
  await db.birthProfile.delete({ where: { id: secondProfileId } });
  expect(await raw.journalEntry.findUnique({ where: { id: removable.id } })).toBeNull();
  await softDeleteAccount(owner);
  expect(await raw.journalEntry.count({ where: { userId: owner } })).toBe(0);
  await expect(
    saveJournalEntry(
      owner,
      { profileId, date: today, mood: 3, text: '', tz: 'America/New_York' },
      'en',
    ),
  ).rejects.toMatchObject({ code: 'E_UNAUTHORIZED' });
});
