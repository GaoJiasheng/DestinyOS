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
      `SELECT id,updatedAt FROM "${table}" WHERE userId IS ? AND (profileId=?${table === 'Reading' ? " OR json_extract(data, '$.inputSnapshot.partnerProfileId')=?" : ''})`,
      userId,
      id,
      ...(table === 'Reading' ? [id] : []),
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
  // DESIGN-GAP: Match Web's oldest-surviving default after deletion, without changing birth versions.
  const remaining = await sql.getAllAsync<{ id: string; data: string }>(
    'SELECT id,data FROM BirthProfile WHERE userId IS ? AND deletedAt IS NULL ORDER BY createdAt,id',
    userId,
  );
  if (
    remaining.length &&
    !remaining.some((row) => (JSON.parse(row.data) as { isDefault?: boolean }).isDefault)
  ) {
    const first = remaining[0]!;
    await sql.runAsync(
      'UPDATE BirthProfile SET data=?,updatedAt=? WHERE id=?',
      JSON.stringify({ ...(JSON.parse(first.data) as Record<string, unknown>), isDefault: true }),
      timestamp,
      first.id,
    );
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
