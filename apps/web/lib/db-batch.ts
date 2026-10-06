import { randomUUID } from 'node:crypto';
import type { Prisma, PrismaClient } from '@prisma/client';
import metadata from './prisma-models.json';
import { getDb, d1Binding } from './db';
import { platform } from './platform/environment';
import { encryptField } from './crypto';
import { stripPII } from './strip-pii';
import { validateDatabaseEnums } from './db-enums';
import { ApiError } from './api-error';
export type SqlStatement = { sql: string; values: (string | number | null)[] };
/** Construct a parameterized statement; SQL text is authored by the server, values never interpolated. */
export function statement(sql: string, ...values: (string | number | null)[]): SqlStatement {
  return { sql, values };
}
/** Execute one atomic D1 batch, or the identical SQLite statements in a local transaction. */
export async function atomicBatch(
  statements: SqlStatement[],
  client?: PrismaClient,
): Promise<void> {
  if (!statements.length) return;
  try {
    if (!client && platform() === 'cloudflare') {
      const db = d1Binding();
      await db.batch(statements.map((s) => db.prepare(s.sql).bind(...s.values)));
    } else {
      const work = async (tx: Pick<Prisma.TransactionClient, '$executeRawUnsafe'>) => {
        for (const s of statements) await tx.$executeRawUnsafe(s.sql, ...s.values);
      };
      if (client) await client.$transaction(work);
      else await getDb().$transaction(work);
    }
  } catch (error) {
    if (String(error).includes('CHECK constraint failed'))
      throw new ApiError('E_CONFLICT', 'Concurrent change; retry', 409);
    throw error;
  }
}
/** Fail the complete batch when its database-side precondition no longer holds. */
export function guard(condition: string, ...values: (string | number | null)[]): SqlStatement[] {
  const id = randomUUID();
  return [
    statement(
      `INSERT INTO "BatchGuard" (id, ok) SELECT ?, CASE WHEN (${condition}) THEN 1 ELSE 0 END`,
      id,
      ...values,
    ),
    statement('DELETE FROM "BatchGuard" WHERE id = ?', id),
  ];
}
function modelFields(table: string) {
  const model = metadata.find((m) => m.name === table);
  if (!model) throw new Error('Unknown database model');
  return model.fields.filter((f) => f.kind !== 'object');
}
/** Serialize SQLite values and apply exactly the existing AES-GCM envelopes to raw batch writes. */
function prepared(
  table: string,
  data: Record<string, unknown>,
  create: boolean,
): Record<string, unknown> {
  const result = { ...data };
  validateDatabaseEnums(table, result);
  const fields = modelFields(table);
  if (create)
    for (const field of fields) {
      if (result[field.name] !== undefined) continue;
      // DESIGN-GAP: Raw D1 batches need IDs before execution; UUIDs coexist with Prisma's unchanged cuid default and deterministic reading IDs.
      if (field.isId && field.type === 'String') result[field.name] = randomUUID();
      else if (
        field.name === 'createdAt' ||
        field.name === 'updatedAt' ||
        field.name === 'authenticatedAt'
      )
        result[field.name] = new Date();
      else if (
        field.hasDefaultValue &&
        (typeof field.default === 'string' ||
          typeof field.default === 'number' ||
          typeof field.default === 'boolean')
      )
        result[field.name] = field.default;
    }
  else if (fields.some((f) => f.name === 'updatedAt')) result.updatedAt = new Date();
  const encrypted: Record<string, readonly string[]> = {
    BirthProfile: ['encBirth', 'encPlace', 'encName', 'label'],
    Reading: ['encInput'],
    JournalEntry: ['text'],
  };
  for (const key of encrypted[table] ?? []) {
    if (typeof result[key] === 'string') {
      if (typeof result.userId !== 'string') throw new Error('Encrypted batch requires owner');
      result[key] = encryptField(result[key], `${table}.${key}`, result.userId);
    }
  }
  if (table === 'Reading' && result.chart !== undefined) result.chart = stripPII(result.chart);
  return result;
}
function encode(table: string, data: Record<string, unknown>) {
  const fields = modelFields(table);
  const entries = Object.entries(data).filter(([, v]) => v !== undefined);
  return entries.map(([key, value]): [string, string | number | null] => {
    const field = fields.find((f) => f.name === key);
    if (!field) throw new Error('Unknown database field');
    if (value === null) return [key, null];
    if (value instanceof Date) return [key, value.toISOString().replace('Z', '+00:00')];
    if (field.type === 'Json') return [key, JSON.stringify(value)];
    if (typeof value === 'boolean') return [key, Number(value)];
    if (typeof value === 'string' || typeof value === 'number') return [key, value];
    throw new Error('Unsupported SQLite value');
  });
}
/** Insert one model using frozen schema metadata; optional suffix is trusted server-authored SQL. */
export function insertRow(table: string, data: Record<string, unknown>, suffix = ''): SqlStatement {
  const entries = encode(table, prepared(table, data, true));
  return statement(
    `INSERT INTO "${table}" (${entries.map(([k]) => `"${k}"`).join(',')}) VALUES (${entries.map(() => '?').join(',')}) ${suffix}`,
    ...entries.map(([, v]) => v),
  );
}
/** Update validated model fields under an explicit owner/version predicate. */
export function updateRows(
  table: string,
  data: Record<string, unknown>,
  where: string,
  ...values: (string | number | null)[]
): SqlStatement {
  const entries = encode(table, prepared(table, data, false));
  return statement(
    `UPDATE "${table}" SET ${entries.map(([k]) => `"${k}" = ?`).join(',')} WHERE ${where}`,
    ...entries.map(([, v]) => v),
    ...values,
  );
}
/** Audit inserts share the same atomic batch as their mutations. */
export function audit(adminId: string, action: string, target?: string, diff?: unknown) {
  return insertRow('AdminAuditLog', { adminId, action, target, diff });
}
