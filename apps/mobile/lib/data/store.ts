import * as Crypto from 'expo-crypto';
import { currentOwner } from '../account/scope';
import { Repository } from './repository';
import { ProfileSchema, ReadingSchema, JournalSchema, SettingsSchema } from './models';
import type { LocalDatabase } from './database';
import { openEncryptedDatabase } from './encryption';
import { erasePersonalData } from './migrations';

/** Build four owner-scoped repositories. Anonymous/null is the default, fully offline scope. */
export function createLocalStore(
  database: LocalDatabase,
  userId: string | null = null,
  uuid = Crypto.randomUUID,
  now = () => new Date(),
) {
  return {
    database,
    profiles: new Repository(database, 'BirthProfile', userId, ProfileSchema, uuid, now),
    readings: new Repository(database, 'Reading', userId, ReadingSchema, uuid, now),
    journal: new Repository(database, 'JournalEntry', userId, JournalSchema, uuid, now),
    settings: new Repository(database, 'Settings', userId, SettingsSchema, uuid, now),
    /** Save one day's mood; preserve the first prediction snapshot across later edits. */
    async saveJournal(raw: unknown) {
      const input = JournalSchema.parse(raw);
      return database.write(async (sql) => {
        const previous = await sql.getFirstAsync<{ id: string; data: string }>(
          'SELECT id,data FROM JournalEntry WHERE userId IS ? AND profileId=? AND date=? AND deletedAt IS NULL',
          userId,
          input.profileId,
          input.date,
        );
        return this.journal.saveInTransaction(
          sql,
          {
            ...input,
            prediction: previous
              ? JournalSchema.parse(JSON.parse(previous.data)).prediction
              : input.prediction,
          },
          previous?.id,
        );
      });
    },
    /** One settings record per scope; patch preserves unmentioned native preferences. */
    async updateSettings(patch: Partial<import('./models').Settings>) {
      return database.write(async (sql) => {
        const previous = await sql.getFirstAsync<{ id: string; data: string }>(
          'SELECT id,data FROM Settings WHERE userId IS ? AND deletedAt IS NULL',
          userId,
        );
        return this.settings.saveInTransaction(
          sql,
          SettingsSchema.parse({
            ...(previous ? SettingsSchema.parse(JSON.parse(previous.data)) : {}),
            ...patch,
          }),
          previous?.id,
        );
      });
    },
    /** Remove only this account's local data, including archived versions and sync cursors. */
    async eraseAccountData() {
      await database.write(async (sql) => {
        await sql.runAsync(
          'DELETE FROM BirthProfileVersion WHERE profileId IN (SELECT id FROM BirthProfile WHERE userId IS ?)',
          userId,
        );
        await sql.runAsync(
          'DELETE FROM ReportFeedback WHERE readingId IN (SELECT id FROM Reading WHERE userId IS ?)',
          userId,
        );
        for (const table of ['JournalEntry', 'Reading', 'Settings', 'BirthProfile'])
          await sql.runAsync(`DELETE FROM "${table}" WHERE userId IS ?`, userId);
        await sql.runAsync('DELETE FROM MobileSyncState WHERE userId IS ?', userId);
      });
    },
    /** Clear all local personal scopes atomically. This is device erasure, not a server delete. */
    async eraseDeviceData() {
      await database.write(erasePersonalData);
    },
  };
}
let databasePromise: Promise<LocalDatabase> | undefined;
/** Share one initialization/key-generation promise; a failure may be retried without data reset. */
export async function getLocalStore(userId: string | null = currentOwner()) {
  if (!databasePromise) {
    databasePromise = openEncryptedDatabase().catch((error: unknown) => {
      databasePromise = undefined;
      throw error;
    });
  }
  return createLocalStore(await databasePromise, userId);
}
