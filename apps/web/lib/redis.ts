import { Redis } from '@upstash/redis';
import IORedis from 'ioredis';
import { logger } from './logger';

let upstash: Redis | undefined;
let local: IORedis | undefined;

/** Return the production Upstash REST client; missing credentials fail closed. */
export function getUpstashRedis(): Redis {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN)
    throw new Error('Upstash Redis credentials are required');
  return (upstash ??= new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  }));
}

/** Connect to compose Redis when REST credentials are not configured. */
export function getLocalRedis(): IORedis {
  if (!process.env.REDIS_URL) throw new Error('REDIS_URL is required');
  if (!local) {
    local = new IORedis(process.env.REDIS_URL, {
      maxRetriesPerRequest: 1,
      connectTimeout: 2000,
      retryStrategy: () => null,
    });
    local.on('error', (error: Error) => logger.warn({ err: error }, 'Redis connection failed'));
  }
  return local;
}

/** Ping the configured cache backend without disclosing connection information. */
export async function pingRedis(): Promise<boolean> {
  const result = process.env.UPSTASH_REDIS_REST_URL
    ? await getUpstashRedis().ping()
    : await getLocalRedis().ping();
  return result === 'PONG';
}
