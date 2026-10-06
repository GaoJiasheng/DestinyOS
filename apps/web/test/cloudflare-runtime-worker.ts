import worker from '../worker';
import { z } from 'zod';
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
    // DESIGN-GAP: Local-only KV control verifies maintenance before OpenNext; never imported by the production entry.
    if (path === '/_smoke/circuit' && request.method === 'POST') {
      const input = z.object({ state: z.enum(['open', 'closed']) }).parse(await request.json());
      await env.CACHE.put('circuit:mode', 'auto');
      await env.CACHE.put('circuit', input.state);
      return Response.json({ state: input.state });
    }
    if (path === '/_smoke/login' && request.method === 'POST') {
      const admin = new URL(request.url).searchParams.get('admin') === '1';
      const existing = admin
        ? await env.DB.prepare('SELECT id FROM User WHERE email=?')
            .bind('smoke-admin@example.test')
            .first<{ id: string }>()
        : null;
      const id = existing?.id ?? crypto.randomUUID(),
        token = crypto.randomUUID();
      const now = new Date().toISOString().replace('Z', '+00:00');
      await env.DB.batch([
        env.DB.prepare(
          'INSERT INTO "User" (id,email,plan,role,"createdAt","updatedAt") VALUES (?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING',
        ).bind(
          id,
          admin ? 'smoke-admin@example.test' : `smoke-${id}@example.test`,
          'pro',
          admin ? 'admin' : 'user',
          now,
          now,
        ),
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
    // DESIGN-GAP: Inspect only public glossary cache keys in the local smoke entry to verify Assets-to-KV loading.
    if (path === '/_smoke/glossary-cache')
      return Response.json(
        (await env.CACHE.list({ prefix: 'glossary:' })).keys.map((key) => key.name),
      );
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
