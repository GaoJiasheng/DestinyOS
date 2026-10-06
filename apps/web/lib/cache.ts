import { platform } from './platform/environment';
import { cloudflareBindings } from './platform/cloudflare';
import { stateRead, stateWrite } from './state';
import { getDb } from './db';
/** Read eventual-consistency cache data from KV; local SQLite is a shared test substitute. */
export async function cacheRead<T>(key: string): Promise<T | null> {
  const raw =
    platform() === 'cloudflare'
      ? await (await cloudflareBindings()).CACHE.get(key)
      : await stateRead(`kv:${key}`);
  return raw === null ? null : (JSON.parse(raw) as T);
}
/** Write JSON to KV with TTL in seconds (minimum KV TTL is 60 seconds). */
export async function cacheWrite(key: string, value: unknown, seconds: number) {
  const raw = JSON.stringify(value);
  if (platform() === 'cloudflare')
    await (
      await cloudflareBindings()
    ).CACHE.put(key, raw, { expirationTtl: Math.max(60, Math.ceil(seconds)) });
  else await stateWrite(`kv:${key}`, raw, seconds);
}
/** Invalidate a cache entry after committing authoritative D1 data. */
export async function cacheDelete(key: string) {
  if (platform() === 'cloudflare') await (await cloudflareBindings()).CACHE.delete(key);
  else await getDb().ephemeralState.deleteMany({ where: { key: `kv:${key}` } });
}
/** Probe KV without writing a permanent health key. */
export async function pingCache() {
  await cacheRead('health:probe');
  return true;
}
/** Enumerate a bounded cache prefix for scheduled maintenance, paging through KV results. */
export async function cacheKeys(prefix: string): Promise<string[]> {
  if (platform() !== 'cloudflare')
    return (
      await getDb().ephemeralState.findMany({
        where: { key: { startsWith: `kv:${prefix}` }, expiresAt: { gt: Date.now() } },
      })
    ).map((r) => r.key.slice(3));
  const namespace = (await cloudflareBindings()).CACHE;
  const keys: string[] = [];
  let cursor: string | undefined;
  do {
    const page = await namespace.list({ prefix, cursor });
    keys.push(...page.keys.map((k) => k.name));
    if (page.list_complete) break;
    cursor = page.cursor;
  } while (cursor);
  return keys;
}
