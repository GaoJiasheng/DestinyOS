import worker from '../worker';
import type {
  D1Database,
  KVNamespace,
  KVNamespacePutOptions,
  R2Bucket,
} from '@cloudflare/workers-types';
interface SmokeEnvironment {
  DB: D1Database;
  CACHE: KVNamespace;
  EXPORT_BUCKET: R2Bucket;
  CRON_SECRET?: string;
  NEXT_PUBLIC_SITE_URL?: string;
}
// DESIGN-GAP: Count successful daily KV writes only in this local entry, proving a reload reads cache without rewriting it.
const dailyCacheWrites = new Map<string, number>();
// DESIGN-GAP: This separate Wrangler-only test entry creates mock sessions without OAuth/email; worker.ts never imports it and no production auth bypass is shipped.
export default {
  async fetch(
    request: Request,
    env: SmokeEnvironment,
    ctx: { waitUntil(p: Promise<unknown>): void },
  ) {
    const path = new URL(request.url).pathname;
    if (path === '/_smoke/login' && request.method === 'POST') {
      const id = crypto.randomUUID(),
        token = crypto.randomUUID();
      const now = new Date().toISOString().replace('Z', '+00:00');
      await env.DB.batch([
        env.DB.prepare(
          'INSERT INTO "User" (id,email,plan,"createdAt","updatedAt") VALUES (?,?,?,?,?)',
        ).bind(id, `smoke-${id}@example.test`, 'pro', now, now),
        env.DB.prepare(
          'INSERT INTO "Session" (id,"sessionToken","userId",expires,"authenticatedAt") VALUES (?,?,?,?,?)',
        ).bind(
          crypto.randomUUID(),
          token,
          id,
          new Date(Date.now() + 3600000).toISOString().replace('Z', '+00:00'),
          now,
        ),
      ]);
      return Response.json({ userId: id, token });
    }
    if (path === '/_smoke/state') {
      const userId = new URL(request.url).searchParams.get('userId');
      if (!userId) return new Response(null, { status: 400 });
      const profiles = await env.DB.prepare(
        'SELECT id,"encBirth",label FROM "BirthProfile" WHERE "userId"=?',
      )
        .bind(userId)
        .all();
      const readings = await env.DB.prepare(
        'SELECT id,system,"encInput" FROM "Reading" WHERE "userId"=?',
      )
        .bind(userId)
        .all();
      const prefix = `daily:${userId}:`;
      const keys = await env.CACHE.list({ prefix });
      return Response.json({
        profiles: profiles.results,
        readings: readings.results,
        cache: keys.keys,
        cacheWrites: Object.fromEntries(
          [...dailyCacheWrites].filter(([key]) => key.startsWith(prefix)),
        ),
      });
    }
    if (path === '/_smoke/export') {
      // Browser Rendering may be unavailable locally; this deterministic renderer mock still exercises the real private R2 binding.
      const key = `mock-${crypto.randomUUID()}`;
      const pdf = new TextEncoder().encode('%PDF-1.4\n% DestinyOS local renderer mock\n%%EOF');
      await env.EXPORT_BUCKET.put(key, pdf);
      const stored = await env.EXPORT_BUCKET.get(key);
      const bytes = await stored?.arrayBuffer();
      await env.EXPORT_BUCKET.delete(key);
      return new Response(bytes, {
        headers: { 'Content-Type': 'application/pdf', 'X-Renderer': 'local-mock' },
      });
    }
    const cache = new Proxy(env.CACHE, {
      get(target, property) {
        if (property === 'put')
          return async (
            key: string,
            value: Parameters<KVNamespace['put']>[1],
            options?: KVNamespacePutOptions,
          ) => {
            await target.put(key, value, options);
            if (key.startsWith('daily:'))
              dailyCacheWrites.set(key, (dailyCacheWrites.get(key) ?? 0) + 1);
          };
        const member: unknown = Reflect.get(target, property, target);
        return typeof member === 'function' ? member.bind(target) : member;
      },
    });
    const forwardedEnv = { ...env, CACHE: cache };
    return worker.fetch(request, forwardedEnv, ctx);
  },
};
