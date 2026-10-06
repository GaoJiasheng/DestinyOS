import { getDb } from './db';
/** Read strongly consistent state, ignoring expired rows immediately. */
export async function stateRead(key: string): Promise<string | null> {
  const row = await getDb().ephemeralState.findUnique({ where: { key } });
  return row && row.expiresAt > Date.now() ? row.value : null;
}
/** Atomically create or reclaim an expired lease; never overwrite a live owner. */
export async function stateReserve(key: string, value: string, seconds: number): Promise<boolean> {
  const now = Date.now();
  const rows = await getDb().$queryRawUnsafe<{ key: string }[]>(
    `INSERT INTO "EphemeralState" (key,value,"expiresAt") VALUES (?,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,"expiresAt"=excluded."expiresAt" WHERE "EphemeralState"."expiresAt" <= ? RETURNING key`,
    key,
    value,
    now + seconds * 1000,
    now,
  );
  return rows.length === 1;
}
/** Store a result with a bounded expiry in D1. */
export async function stateWrite(key: string, value: string, seconds: number) {
  await getDb().ephemeralState.upsert({
    where: { key },
    create: { key, value, expiresAt: Date.now() + seconds * 1000 },
    update: { value, expiresAt: Date.now() + seconds * 1000 },
  });
}
/** Compare and delete a live single-use token or lease; a previous owner cannot remove a replacement. */
export async function stateRelease(key: string, value: string): Promise<boolean> {
  const result = await getDb().ephemeralState.deleteMany({
    where: { key, value, expiresAt: { gt: Date.now() } },
  });
  return result.count === 1;
}
/** Remove expired reservations, rate counters, Auth.js tokens and old daily quotas on scheduled maintenance. */
export async function cleanExpiredState(now = new Date()) {
  const db = getDb();
  await db.ephemeralState.deleteMany({ where: { expiresAt: { lte: now.getTime() } } });
  await db.rateLimitHit.deleteMany({ where: { expiresAt: { lte: now.getTime() } } });
  await db.rateLimitCounter.deleteMany({ where: { expiresAt: { lte: now.getTime() } } });
  await db.verificationToken.deleteMany({ where: { expires: { lte: now } } });
  await db.chatQuota.deleteMany({ where: { day: { lt: new Date(now.getTime() - 7 * 86400000) } } });
}
