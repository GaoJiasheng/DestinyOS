import type { SqlConnection } from './database';
import { SettingsSchema } from './models';
/** Propagate both local and server profile tombstones without retaining personal snapshots. */
export async function deleteProfileDependents(
  sql: SqlConnection,
  id: string,
  userId: string | null,
  timestamp: string,
) {
  await sql.runAsync('DELETE FROM BirthProfileVersion WHERE profileId=?', id);
  for (const table of ['Reading', 'JournalEntry'] as const) {
    const children = await sql.getAllAsync<{ id: string; updatedAt: string }>(
      `SELECT id,updatedAt FROM "${table}" WHERE userId IS ? AND profileId=?`,
      userId,
      id,
    );
    for (const child of children) {
      const deletedAt = new Date(
        Math.max(Date.parse(timestamp), Date.parse(child.updatedAt) + 1),
      ).toISOString();
      await sql.runAsync(
        `UPDATE "${table}" SET data=NULL,deletedAt=?,updatedAt=?,profileId=NULL,date=NULL WHERE id=?`,
        deletedAt,
        deletedAt,
        child.id,
      );
    }
  }
  const settings = await sql.getFirstAsync<{ id: string; data: string; updatedAt: string }>(
    'SELECT id,data,updatedAt FROM Settings WHERE userId IS ? AND deletedAt IS NULL',
    userId,
  );
  if (settings) {
    const value = SettingsSchema.parse(JSON.parse(settings.data));
    if (value.activeProfileId === id) {
      const updatedAt = new Date(
        Math.max(Date.parse(timestamp), Date.parse(settings.updatedAt) + 1),
      ).toISOString();
      await sql.runAsync(
        'UPDATE Settings SET data=?,updatedAt=? WHERE id=?',
        JSON.stringify({ ...value, activeProfileId: null }),
        updatedAt,
        settings.id,
      );
    }
  }
}
