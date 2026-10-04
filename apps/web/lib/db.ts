import { PrismaClient } from '@prisma/client';
import { fieldEncryptionExtension } from './db-encryption';

const globalDb = globalThis as typeof globalThis & { tianjiDb?: ReturnType<typeof createDb> };
function createDb() {
  const raw = new PrismaClient();
  return raw.$extends(fieldEncryptionExtension());
}

/** Lazily create the shared encrypted Prisma client, retaining connections through development reloads. */
export function getDb() {
  globalDb.tianjiDb ??= createDb();
  return globalDb.tianjiDb;
}
