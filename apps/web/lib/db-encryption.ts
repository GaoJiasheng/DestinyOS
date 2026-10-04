import { Prisma } from '@prisma/client';
import { decryptField, encryptField } from './crypto';
import { stripPII } from './strip-pii';

type RecordValue = Record<string, unknown>;
const encrypted: Record<string, readonly string[]> = {
  BirthProfile: ['encBirth', 'encPlace', 'encName'],
  Reading: ['encInput'],
};
const models = new Map(Prisma.dmmf.datamodel.models.map((model) => [model.name, model]));
function record(value: unknown): value is RecordValue {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function containsEncrypted(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(containsEncrypted);
  return (
    record(value) &&
    Object.entries(value).some(([key, item]) => /^enc[A-Z]/.test(key) || containsEncrypted(item))
  );
}
function assertWhere(value: unknown) {
  if (containsEncrypted(value)) throw new Error('Encrypted fields cannot be used in where');
}

function prepareSelection(model: string, args: RecordValue) {
  const fields = encrypted[model];
  if (fields && record(args.omit) && args.omit.userId) delete args.omit.userId;
  if (
    fields &&
    record(args.select) &&
    fields.some((field) => args.select && record(args.select) && args.select[field])
  ) {
    args.select.userId = true;
  }
  const selection = record(args.select)
    ? args.select
    : record(args.include)
      ? args.include
      : undefined;
  if (!selection) return;
  for (const field of models.get(model)?.fields ?? []) {
    const child = selection[field.name];
    if (field.kind === 'object' && record(child)) prepareSelection(field.type, child);
  }
}

function decode(model: string, result: unknown, originalArgs: RecordValue): unknown {
  if (Array.isArray(result)) return result.map((row) => decode(model, row, originalArgs));
  if (!record(result)) return result;
  const output = { ...result };
  for (const field of encrypted[model] ?? []) {
    const value = output[field];
    if (typeof value === 'string') {
      if (typeof output.userId !== 'string') throw new Error('Encrypted record requires its owner');
      output[field] = decryptField(value, `${model}.${field}`, output.userId);
    }
  }
  const selection = record(originalArgs.select)
    ? originalArgs.select
    : record(originalArgs.include)
      ? originalArgs.include
      : {};
  for (const field of models.get(model)?.fields ?? []) {
    if (field.kind === 'object' && output[field.name] !== undefined) {
      const childArgs = selection[field.name];
      output[field.name] = decode(
        field.type,
        output[field.name],
        record(childArgs) ? childArgs : {},
      );
    }
  }
  if (encrypted[model] && record(originalArgs.select) && !originalArgs.select.userId)
    delete output.userId;
  if (encrypted[model] && record(originalArgs.omit) && originalArgs.omit.userId)
    delete output.userId;
  return output;
}

// DESIGN-GAP: Prisma String enc* columns expose plaintext UTF-8 JSON strings; domain callers parse/serialize typed objects.
/** Client extension: encrypted fields are plaintext UTF-8 JSON strings at the application boundary. */
export function fieldEncryptionExtension() {
  return Prisma.defineExtension({
    name: 'field-encryption',
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          const original = structuredClone(args) as RecordValue;
          const input = args as RecordValue;
          // Inspect nested filters as well as the outer where.
          function checkFilters(value: unknown): void {
            if (Array.isArray(value)) {
              value.forEach(checkFilters);
              return;
            }
            if (!record(value)) return;
            for (const [key, item] of Object.entries(value)) {
              if (
                key === 'where' ||
                key === 'cursor' ||
                key === 'orderBy' ||
                key === 'having' ||
                key === 'by'
              )
                assertWhere(item);
              else checkFilters(item);
            }
          }
          checkFilters(input);
          if ((operation === 'aggregate' || operation === 'groupBy') && containsEncrypted(input))
            throw new Error('Encrypted aggregates are unsupported');
          const fields = encrypted[model] ?? [];
          const write = async (data: unknown): Promise<void> => {
            if (Array.isArray(data)) {
              for (const row of data) await write(row);
              return;
            }
            if (!record(data)) return;
            if (model === 'Reading' && data.chart !== undefined) data.chart = stripPII(data.chart);
            if (
              operation === 'update' &&
              fields.length &&
              (data.userId !== undefined || data.user !== undefined)
            )
              throw new Error('Encrypted ownership cannot be changed');
            // DESIGN-GAP: Prisma query extensions do not intercept nested writes. Reject encrypted nested writes;
            // use top-level model operations in a transaction so encryption cannot be silently bypassed.
            for (const [key, value] of Object.entries(data)) {
              if (!fields.includes(key) && containsEncrypted(value))
                throw new Error('Use top-level operations for encrypted nested writes');
            }
            for (const relation of models.get(model)?.fields ?? []) {
              if (relation.kind === 'object' && data[relation.name] !== undefined) {
                const nested = data[relation.name];
                if (
                  encrypted[relation.type] ||
                  (record(nested) &&
                    [
                      'create',
                      'update',
                      'upsert',
                      'createMany',
                      'updateMany',
                      'connectOrCreate',
                    ].some((key) => key in nested))
                ) {
                  throw new Error('Use top-level operations for encrypted nested writes');
                }
              }
            }
            if (!fields.length) return;
            const hasEncrypted = fields.some(
              (field) => data[field] !== undefined && data[field] !== null,
            );
            if (!hasEncrypted && data.userId === undefined && data.user === undefined) return;
            if (/^(updateMany|deleteMany)/.test(operation)) {
              if (hasEncrypted || data.userId !== undefined || data.user !== undefined)
                throw new Error('Encrypted bulk updates are unsupported');
              return;
            }
            // DESIGN-GAP: Encrypted updates require owner in the unique filter (id + userId, or userId_version).
            // This avoids a second connection/lookup outside interactive transactions and also checks ownership atomically.
            const where = record(input.where) ? input.where : {};
            const compound = record(where.userId_version) ? where.userId_version : {};
            const existingOwner =
              typeof where.userId === 'string'
                ? where.userId
                : typeof compound.userId === 'string'
                  ? compound.userId
                  : undefined;
            if (operation === 'update' && hasEncrypted && !existingOwner)
              throw new Error('Encrypted update requires where.userId');
            const connected =
              record(data.user) && record(data.user.connect) ? data.user.connect.id : undefined;
            const owner =
              typeof data.userId === 'string'
                ? data.userId
                : typeof connected === 'string'
                  ? connected
                  : existingOwner;
            // DESIGN-GAP: Anonymous readings remain device-only; persisted encrypted rows must have a user owner.
            if (!owner) throw new Error('Encrypted record requires a userId');
            if (existingOwner !== undefined && existingOwner !== owner)
              throw new Error('Encrypted ownership cannot be changed');
            for (const field of fields) {
              const value = data[field];
              if (value === undefined || value === null) continue;
              const plain = record(value) ? value.set : value;
              if (typeof plain !== 'string')
                throw new Error('Encrypted field must be a plaintext string');
              const cipher = encryptField(plain, `${model}.${field}`, owner);
              data[field] = record(value) ? { set: cipher } : cipher;
            }
          };
          await write(input.data);
          await write(input.create);
          await write(input.update);
          prepareSelection(model, input);
          return decode(model, await query(args), original);
        },
      },
    },
  });
}
