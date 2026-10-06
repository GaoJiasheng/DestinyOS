import { PrismaClient } from '@prisma/client';
import { PrismaD1 } from '@prisma/adapter-d1';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import type { D1Database } from '@cloudflare/workers-types';
import { databaseScope } from './platform/database-scope';
import { platform } from './platform/environment';
import { fieldEncryptionExtension } from './db-encryption';
import { databaseEnumsExtension } from './db-enums';
import { localAdapter } from './db-local';
const globalDb = globalThis as typeof globalThis & { tianjiDb?: ReturnType<typeof createDb> };
/** Return the primary D1 binding synchronously inside a Workers request. */
export function d1Binding(): D1Database {
  return (getCloudflareContext().env as unknown as { DB: D1Database }).DB;
}
function createDb() {
  const raw = new PrismaClient({
    adapter: platform() === 'cloudflare' ? new PrismaD1(d1Binding()) : localAdapter(),
  });
  return raw.$extends(fieldEncryptionExtension()).$extends(databaseEnumsExtension());
}
/** Lazily resolve a request-scoped D1 client or a development SQLite client. */
export function getDb() {
  if (platform() === 'cloudflare') {
    const scope = databaseScope();
    if (!scope) throw new Error('Workers database requires request scope');
    const existing = scope.clients.get('prisma') as ReturnType<typeof createDb> | undefined;
    if (existing) return existing;
    const client = createDb();
    scope.clients.set('prisma', client);
    return client;
  }
  return (globalDb.tianjiDb ??= createDb());
}
