import { PrismaClient } from '@prisma/client';
import { PrismaNeon } from '@prisma/adapter-neon';
import { databaseScope } from './platform/database-scope';
import { platform } from './platform/environment';
import { fieldEncryptionExtension } from './db-encryption';

const globalDb = globalThis as typeof globalThis & { tianjiDb?: ReturnType<typeof createDb> };
function createDb() {
  // DESIGN-GAP: Workers use the Neon WebSocket adapter for interactive transactions; Node retains its native PostgreSQL driver.
  const raw =
    platform() === 'cloudflare'
      ? new PrismaClient({
          adapter: new PrismaNeon({ connectionString: process.env.DATABASE_URL }),
        })
      : new PrismaClient();
  return raw.$extends(fieldEncryptionExtension());
}

/** Lazily create the shared encrypted Prisma client, retaining connections through development reloads. */
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
  globalDb.tianjiDb ??= createDb();
  return globalDb.tianjiDb;
}
