import * as Sentry from '@sentry/react-native';
import type { z } from 'zod';
import { Repository } from './repository';
import { MetadataSchema, type Entity, type LocalRecord, type Metadata } from './models';
import type { LocalDatabase } from './database';

interface Row extends Metadata {
  data: string | null;
}
/** Report only the table name: a skipped row's content may hold birth details. */
function reportSkipped(entity: Entity) {
  Sentry.captureException(new Error(`E_LOCAL_RECORD_SKIPPED_${entity}`));
}
/**
 * Lists skip rows that no longer pass validation instead of failing the whole read, so one
 * damaged or outdated record cannot lock every screen. Rows are never deleted automatically.
 */
export class TolerantRepository<T> extends Repository<T> {
  constructor(
    database: LocalDatabase,
    entity: Entity,
    userId: string | null,
    private readonly content: z.ZodType<T, z.ZodTypeDef, unknown>,
    uuid: () => string,
    now: () => Date,
    private readonly onSkip: (entity: Entity) => void = reportSkipped,
  ) {
    super(database, entity, userId, content, uuid, now);
  }
  override async list(limit = 50, offset = 0): Promise<LocalRecord<T>[]> {
    if (
      !Number.isInteger(limit) ||
      limit < 1 ||
      limit > 500 ||
      !Number.isInteger(offset) ||
      offset < 0
    )
      throw new Error('E_INVALID_INPUT');
    const rows = await this.database.read((sql) =>
      sql.getAllAsync<Row>(
        `SELECT * FROM "${this.entity}" WHERE userId IS ? AND deletedAt IS NULL ORDER BY createdAt DESC, id DESC LIMIT ? OFFSET ?`,
        this.userId,
        limit,
        offset,
      ),
    );
    const records: LocalRecord<T>[] = [];
    let skipped = false;
    for (const row of rows) {
      const record = this.tryDecode(row);
      if (record) records.push(record);
      else skipped = true;
    }
    if (skipped) this.onSkip(this.entity);
    return records;
  }
  private tryDecode(row: Row): LocalRecord<T> | null {
    const metadata = MetadataSchema.safeParse({
      id: row.id,
      userId: row.userId,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      deletedAt: row.deletedAt,
    });
    if (!metadata.success) return null;
    if (row.data === null) return { ...metadata.data, data: null };
    let raw: unknown;
    try {
      raw = JSON.parse(row.data);
    } catch {
      return null;
    }
    const data = this.content.safeParse(raw);
    return data.success ? { ...metadata.data, data: data.data } : null;
  }
}
