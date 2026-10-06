import { cacheRead, cacheWrite, cacheKeys, cacheDelete } from './cache';
import { atomicBatch, statement } from './db-batch';
/** Approximate public share counts use KV; never put identity or private input in these cache keys. */
export async function recordShareView(token: string, now = new Date()) {
  // DESIGN-GAP: KV counters are approximate under concurrent reads; day buckets become immutable before scheduled flushing, which avoids deleting an active writer's bucket.
  const key = `share:views:${token}:${now.toISOString().slice(0, 10)}`;
  try {
    await cacheWrite(key, ((await cacheRead<number>(key)) ?? 0) + 1, 3 * 86400);
  } catch {
    /* Non-critical approximate analytics must not block public reports. */
  }
}
/** Flush completed-day KV buckets exactly once to D1, with an idempotent marker in the same batch. */
export async function flushShareViews(now = new Date()) {
  const today = now.toISOString().slice(0, 10);
  for (const key of await cacheKeys('share:views:')) {
    const match = /^share:views:([A-Za-z0-9]{22}):(\d{4}-\d{2}-\d{2})$/.exec(key);
    if (!match || match[2]! >= today) continue;
    const value = await cacheRead<unknown>(key);
    if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) continue;
    const marker = `flushed:${key}`;
    await atomicBatch([
      statement(
        'UPDATE "ShareLink" SET views=views+? WHERE token=? AND NOT EXISTS (SELECT 1 FROM "EphemeralState" WHERE key=?)',
        value,
        match[1]!,
        marker,
      ),
      statement(
        'INSERT INTO "EphemeralState" (key,value,"expiresAt") VALUES (?, ?, ?) ON CONFLICT(key) DO NOTHING',
        marker,
        'done',
        now.getTime() + 7 * 86400000,
      ),
    ]);
    await cacheDelete(key);
  }
}
