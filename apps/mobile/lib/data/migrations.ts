import type { LocalDatabase, SqlConnection } from './database';
// DESIGN-GAP: SQLCipher encrypts every page, including indexed fields and tombstones. JSON
// payloads expose decrypted domain names; encBirth/encInput prefixes are server field ciphers only.
const entities = ['BirthProfile', 'Reading', 'JournalEntry', 'Settings'] as const;
export const migrations: readonly string[] = [
  entities
    .map(
      (table) => `
    CREATE TABLE "${table}" (
      id TEXT PRIMARY KEY NOT NULL,
      userId TEXT,
      data TEXT,
      profileId TEXT,
      date TEXT,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      deletedAt TEXT,
      CHECK ((deletedAt IS NULL AND data IS NOT NULL) OR (deletedAt IS NOT NULL AND data IS NULL))
    );
    CREATE INDEX "${table}_owner_updated" ON "${table}" (userId, updatedAt, id);
  `,
    )
    .join('\n') +
    `
    CREATE UNIQUE INDEX journal_profile_date ON JournalEntry(profileId, date) WHERE deletedAt IS NULL;
    CREATE UNIQUE INDEX settings_owner ON Settings(COALESCE(userId, '')) WHERE deletedAt IS NULL;
    CREATE TABLE BirthProfileVersion (
      profileId TEXT NOT NULL REFERENCES BirthProfile(id) ON DELETE CASCADE,
      version INTEGER NOT NULL CHECK (version > 0),
      data TEXT NOT NULL,
      PRIMARY KEY (profileId, version)
    );`,
  `CREATE TABLE KnowledgeCache (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    knowledgeVersion TEXT NOT NULL,
    data TEXT NOT NULL
  );`,
  // DESIGN-GAP: Offline section feedback has no mobile API in the plan. Keep an encrypted,
  // device-only vote keyed by reading/section; M09 may later supply an explicit sync contract.
  `CREATE TABLE ReportFeedback (
    readingId TEXT NOT NULL REFERENCES Reading(id) ON DELETE CASCADE,
    section TEXT NOT NULL,
    helpful INTEGER NOT NULL CHECK (helpful IN (0,1)),
    updatedAt TEXT NOT NULL,
    PRIMARY KEY (readingId, section)
  );
  CREATE TRIGGER reading_feedback_delete AFTER UPDATE OF deletedAt ON Reading
  WHEN NEW.deletedAt IS NOT NULL BEGIN DELETE FROM ReportFeedback WHERE readingId=NEW.id; END;`,
];
/** Upgrade atomically; never silently downgrade an unknown future schema. */
export async function migrate(database: LocalDatabase): Promise<void> {
  await database.write(async (sql) => {
    const row = await sql.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
    const version = row?.user_version ?? 0;
    if (version > migrations.length) throw new Error('E_LOCAL_SCHEMA_NEWER');
    for (let index = version; index < migrations.length; index++) {
      await sql.execAsync(migrations[index]!);
      await sql.execAsync(`PRAGMA user_version = ${index + 1}`);
    }
  });
}
/** Remove personal content immediately, including archived profile versions; retain public knowledge. */
export async function erasePersonalData(sql: SqlConnection): Promise<void> {
  await sql.execAsync('DELETE FROM ReportFeedback');
  await sql.execAsync('DELETE FROM BirthProfileVersion');
  for (const table of entities) await sql.execAsync(`DELETE FROM "${table}"`);
}
