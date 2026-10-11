import type { D1Database, KVNamespace } from '@cloudflare/workers-types';
import { checkHealth } from '../health';
import engine from '../../../../packages/engine/package.json';
import manifest from '../../../../packages/content/version.json';
/** Probe D1 directly without constructing Prisma or loading Next, engines, knowledge assets or Sentry. */
export async function workerHealth(
  db: D1Database,
  kv: KVNamespace,
  cache: Pick<Cache, 'match' | 'put'> | undefined,
  request: Request,
  waitUntil: (p: Promise<unknown>) => void,
): Promise<Response> {
  const key = new Request(new URL('/api/v1/health', request.url));
  const match = await cache?.match(key).catch(() => undefined);
  const cached = match ? new Response(match.body, match) : undefined;
  if (cached) {
    cached.headers.set('Cache-Control', 'no-store');
    cached.headers.set('X-Destiny-Health', 'HIT');
    cached.headers.delete('Server-Timing');
    return cached;
  }
  let d1Ms = 0,
    kvMs = 0;
  const data = await checkHealth(
    {
      db: async () => {
        const started = performance.now();
        try {
          return await db.prepare('SELECT 1').first();
        } finally {
          d1Ms = performance.now() - started;
        }
      },
      redis: async () => {
        const started = performance.now();
        try {
          await kv.get('health:probe');
          return true;
        } finally {
          kvMs = performance.now() - started;
        }
      },
    },
    { engineVersion: engine.version, knowledgeVersion: manifest.knowledgeVersion },
  );
  const response = Response.json(data, {
    status: data.ok ? 200 : 503,
    headers: {
      'Cache-Control': 'no-store',
      'X-Destiny-Health': 'MISS',
      'Server-Timing': `d1;dur=${d1Ms.toFixed(2)}, kv;dur=${kvMs.toFixed(2)}`,
    },
  });
  // DESIGN-GAP: Successful dependency checks are at most 60 seconds old; failures are never cached and retain the documented response keys.
  if (data.ok && cache) {
    const stored = response.clone();
    stored.headers.set('Cache-Control', 'public, max-age=60');
    waitUntil(cache.put(key, stored).catch(() => undefined));
  }
  return response;
}
