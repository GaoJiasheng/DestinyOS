import { getLocalRedis, getUpstashRedis } from './redis';
/** Read a JSON value from either supported Redis backend. */
export async function cacheRead<T>(key: string): Promise<T | null> {
  if (process.env.UPSTASH_REDIS_REST_URL) return getUpstashRedis().get<T>(key);
  const raw = await getLocalRedis().get(key);
  return raw ? (JSON.parse(raw) as T) : null;
}
/** Store a JSON value with a bounded lifetime in seconds. */
export async function cacheWrite(key: string, value: unknown, seconds: number) {
  if (process.env.UPSTASH_REDIS_REST_URL) await getUpstashRedis().set(key, value, { ex: seconds });
  else await getLocalRedis().set(key, JSON.stringify(value), 'EX', seconds);
}
/** Invalidate cached state after a committed administrator write. */
export async function cacheDelete(key: string) {
  if (process.env.UPSTASH_REDIS_REST_URL) await getUpstashRedis().del(key);
  else await getLocalRedis().del(key);
}
