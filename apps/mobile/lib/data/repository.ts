import { deleteProfileDependents } from './delete-profile';
import { normalizeBirth } from '@tianji/engine';
import type { LocalDatabase, SqlConnection } from './database';
import { z } from 'zod';
import {
  MetadataSchema,
  ProfileSchema,
  ReadingSchema,
  JournalSchema,
  SettingsSchema,
  type Metadata,
  type LocalRecord,
  type Entity,
  TimestampSchema,
} from './models';

interface Row extends Metadata {
  data: string | null;
}
/** Scope null means anonymous local data; no network/authentication dependency exists. */
export class Repository<T> {
  constructor(
    readonly database: LocalDatabase,
    readonly entity: Entity,
    readonly userId: string | null,
    private readonly schema: z.ZodType<T, z.ZodTypeDef, unknown>,
    private readonly uuid: () => string,
    private readonly now: () => Date = () => new Date(),
  ) {
    if (userId !== null) MetadataSchema.shape.userId.parse(userId);
  }
  /** Read one owned live record; tombstones are only exposed through changes(). */
  async get(id: string): Promise<LocalRecord<T> | null> {
    return this.database.read(async (sql) => {
      const row = await this.row(sql, id);
      return row && !row.deletedAt ? this.decode(row) : null;
    });
  }
  /** Stable newest-first list with bounded pagination. */
  async list(limit = 50, offset = 0): Promise<LocalRecord<T>[]> {
    if (
      !Number.isInteger(limit) ||
      limit < 1 ||
      limit > 500 ||
      !Number.isInteger(offset) ||
      offset < 0
    )
      throw new Error('E_INVALID_INPUT');
    return this.database.read(async (sql) =>
      (
        await sql.getAllAsync<Row>(
          `SELECT * FROM "${this.entity}" WHERE userId IS ? AND deletedAt IS NULL ORDER BY createdAt DESC, id DESC LIMIT ? OFFSET ?`,
          this.userId,
          limit,
          offset,
        )
      ).map((row) => this.decode(row)),
    );
  }
  /** Save validated content; edits advance UTC updatedAt even if the device clock moves backwards. */
  async save(raw: unknown, id = this.uuid()): Promise<LocalRecord<T>> {
    return this.database.write((sql) => this.saveInTransaction(sql, raw, id));
  }
  /** Compose a save into an existing database transaction (settings/journal uniqueness). */
  async saveInTransaction(
    sql: SqlConnection,
    raw: unknown,
    id = this.uuid(),
  ): Promise<LocalRecord<T>> {
    const previous = await this.row(sql, id);
    if (previous?.deletedAt) throw new Error('E_LOCAL_DELETED');
    let data: unknown = this.schema.parse(raw);
    const updatedAt = this.timestamp(previous?.updatedAt);
    if (this.entity === 'BirthProfile') {
      const profile = ProfileSchema.parse(data);
      const local = normalizeBirth(profile.birth).local;
      const today = this.now();
      // DESIGN-GAP: Same neutral age gate as Web: normalized Gregorian birthday, UTC boundary.
      const age =
        today.getUTCFullYear() -
        local.year -
        (today.getUTCMonth() + 1 < local.month ||
        (today.getUTCMonth() + 1 === local.month && today.getUTCDate() < local.day)
          ? 1
          : 0);
      if (age < 13) throw new Error('E_AGE_RESTRICTED');
      const old = previous?.data ? (JSON.parse(previous.data) as unknown) : null;
      const oldProfile = old ? ProfileSchema.parse(old) : null;
      data = {
        ...(oldProfile?.relation && !profile.relation ? { relation: oldProfile.relation } : {}),
        ...(oldProfile?.isDefault !== undefined && profile.isDefault === undefined
          ? { isDefault: oldProfile.isDefault }
          : {}),
        ...profile,
        version: (oldProfile?.version ?? 0) + 1,
      };
    }
    const record = {
      id,
      userId: this.userId,
      createdAt: previous?.createdAt ?? updatedAt,
      updatedAt,
      deletedAt: null,
      data: this.schema.parse(data),
    };
    await this.persist(sql, record);
    return record;
  }
  /** Redact deleted content immediately; keep only identity/timestamp tombstones for later sync. */
  async delete(id: string): Promise<void> {
    await this.database.write(async (sql) => {
      const previous = await this.row(sql, id);
      if (!previous || previous.deletedAt) return;
      const deletedAt = this.timestamp(previous.updatedAt);
      await this.persist(sql, { ...previous, updatedAt: deletedAt, deletedAt, data: null });
    });
  }
  /** Incremental export includes tombstones; callers send only the confirmed account's scope. */
  async changes(since?: string): Promise<LocalRecord<T>[]> {
    if (since) TimestampSchema.parse(since);
    return this.database.read(async (sql) =>
      (
        await sql.getAllAsync<Row>(
          `SELECT * FROM "${this.entity}" WHERE userId IS ? AND updatedAt >= ? ORDER BY updatedAt, id`,
          this.userId,
          since ?? '',
        )
      ).map((row) => this.decode(row)),
    );
  }
  /** Apply authoritative server records atomically; equal timestamps prefer the server. */
  async applyRemote(rawRecords: readonly unknown[]): Promise<void> {
    if (this.userId === null) throw new Error('E_UNAUTHORIZED');
    const records = rawRecords.map((raw) => {
      const parsed = z.object({ data: z.unknown() }).passthrough().parse(raw);
      const metadata = MetadataSchema.parse({
        id: parsed.id,
        userId: parsed.userId,
        createdAt: parsed.createdAt,
        updatedAt: parsed.updatedAt,
        deletedAt: parsed.deletedAt,
      });
      const data = parsed.data === null ? null : this.schema.parse(parsed.data);
      if (metadata.userId !== this.userId || (metadata.deletedAt === null) !== (data !== null))
        throw new Error('E_FORBIDDEN');
      return { ...metadata, data };
    });
    await this.database.write(async (sql) => {
      for (const record of records) {
        const previous = await this.row(sql, record.id);
        if (!previous || record.deletedAt !== null || record.updatedAt >= previous.updatedAt)
          await this.persist(sql, record);
      }
    });
  }
  private timestamp(previous?: string): string {
    return new Date(
      Math.max(this.now().getTime(), previous ? Date.parse(previous) + 1 : 0),
    ).toISOString();
  }
  private async row(sql: SqlConnection, id: string): Promise<Row | null> {
    const row = await sql.getFirstAsync<Row>(`SELECT * FROM "${this.entity}" WHERE id=?`, id);
    if (row && row.userId !== this.userId) throw new Error('E_FORBIDDEN');
    return row;
  }
  private decode(row: Row): LocalRecord<T> {
    return {
      ...MetadataSchema.parse({
        id: row.id,
        userId: row.userId,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        deletedAt: row.deletedAt,
      }),
      data: row.data === null ? null : this.schema.parse(JSON.parse(row.data)),
    };
  }
  private async persist(sql: SqlConnection, record: LocalRecord<T>): Promise<void> {
    MetadataSchema.parse({
      id: record.id,
      userId: record.userId,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      deletedAt: record.deletedAt,
    });
    let profileId: string | null = null,
      date: string | null = null;
    if (record.data !== null && (this.entity === 'Reading' || this.entity === 'JournalEntry')) {
      const content =
        this.entity === 'Reading'
          ? ReadingSchema.parse(record.data)
          : JournalSchema.parse(record.data);
      profileId = content.profileId;
      if (this.entity === 'JournalEntry') {
        const journal = JournalSchema.parse(record.data);
        date = journal.date;
        // DESIGN-GAP: Match Web's past-day reflection rule in the entry's explicit IANA zone.
        const parts = new Intl.DateTimeFormat('en', {
          timeZone: journal.tz,
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
        }).formatToParts(this.now());
        const part = (type: Intl.DateTimeFormatPartTypes) =>
          parts.find((item) => item.type === type)?.value;
        if (date > `${part('year')}-${part('month')}-${part('day')}`)
          throw new Error('E_DATE_OUT_OF_RANGE');
      }
      if (profileId) {
        const profile = await sql.getFirstAsync<Row>(
          'SELECT * FROM BirthProfile WHERE id=? AND userId IS ? AND deletedAt IS NULL',
          profileId,
          this.userId,
        );
        if (!profile) throw new Error('E_FORBIDDEN');
      }
    }
    if (record.data !== null && this.entity === 'Settings') {
      const selected = SettingsSchema.parse(record.data).activeProfileId;
      if (
        selected &&
        !(await sql.getFirstAsync(
          'SELECT id FROM BirthProfile WHERE id=? AND userId IS ? AND deletedAt IS NULL',
          selected,
          this.userId,
        ))
      )
        throw new Error('E_FORBIDDEN');
    }
    await sql.runAsync(
      `INSERT INTO "${this.entity}" (id,userId,data,profileId,date,createdAt,updatedAt,deletedAt)
      VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data,profileId=excluded.profileId,date=excluded.date,updatedAt=excluded.updatedAt,deletedAt=excluded.deletedAt`,
      record.id,
      record.userId,
      record.data === null ? null : JSON.stringify(record.data),
      profileId,
      date,
      record.createdAt,
      record.updatedAt,
      record.deletedAt,
    );
    if (record.data === null && this.entity === 'BirthProfile')
      await deleteProfileDependents(
        sql,
        record.id,
        this.userId,
        record.deletedAt ?? record.updatedAt,
      );
    if (record.data !== null && this.entity === 'BirthProfile') {
      const profile = ProfileSchema.parse(record.data);
      await sql.runAsync(
        "UPDATE BirthProfileVersion SET data=json_set(data, '$.isCurrent', json('false')) WHERE profileId=?",
        record.id,
      );
      await sql.runAsync(
        'INSERT INTO BirthProfileVersion(profileId,version,data) VALUES(?,?,?) ON CONFLICT(profileId,version) DO UPDATE SET data=excluded.data',
        record.id,
        profile.version,
        JSON.stringify(record.data),
      );
    }
  }
}
