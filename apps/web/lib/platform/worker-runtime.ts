import type { D1Database, KVNamespace } from '@cloudflare/workers-types';
import { circuitOpen, circuitBypass } from './circuit-policy';
import { publicCacheRequest, publicCachedFetch } from './public-cache';
import { writeWorkerLog } from './logger-sink';
import { workerHealth } from './worker-health';
import { withDatabaseScope } from './database-scope';
export interface WorkerEnvironment {
  CACHE: KVNamespace;
  DB?: D1Database;
  CF_VERSION_METADATA?: { id: string };
  PERF_OBSERVABILITY?: string;
  FEATURE_WEB_PAYMENTS?: string;
  CRON_SECRET?: string;
  NEXT_PUBLIC_SITE_URL?: string;
}
export interface WorkerContext {
  waitUntil(promise: Promise<unknown>): void;
}
/** Stop disabled payment and maintenance traffic before creating a database scope or invoking OpenNext. */
export async function workerFetch(
  request: Request,
  env: WorkerEnvironment,
  ctx: WorkerContext,
  dispatch: (request: Request) => Promise<Response>,
): Promise<Response> {
  const path = new URL(request.url).pathname;
  if (/^\/api\/v1\/stripe(?:\/|$)/.test(path) && env.FEATURE_WEB_PAYMENTS !== 'true')
    return new Response(null, { status: 404 });
  const started = performance.now();
  let gateMs = 0;
  const finish = (response: Response, phase: string) => {
    const headers = new Headers(response.headers);
    // DESIGN-GAP: Language preference is generated per outgoing request, outside the shared object; no authentication cookies enter Cache API.
    if (phase === 'public' && response.status === 200 && !headers.has('set-cookie')) {
      const locale = path.split('/')[1];
      const preference = request.headers.get('cookie')?.match(/(?:^|;\s*)NEXT_LOCALE=([^;]*)/)?.[1];
      if (locale && locale !== preference)
        headers.append('Set-Cookie', `NEXT_LOCALE=${locale}; Path=/; SameSite=Lax`);
    }
    const totalMs = performance.now() - started;
    headers.append(
      'Server-Timing',
      `gate;dur=${gateMs.toFixed(2)}, ${phase};dur=${(totalMs - gateMs).toFixed(2)}`,
    );
    // DESIGN-GAP: Observability logs contain a route class, cache state and durations only, never URLs, request bodies, cookies or user IDs.
    if (env.PERF_OBSERVABILITY === 'true')
      writeWorkerLog('info', {
        event: 'request-lifecycle',
        phase,
        gateMs,
        totalMs,
        cache: headers.get('X-Destiny-Cache') ?? headers.get('X-Destiny-Health'),
      });
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  };
  const waitUntil = (promise: Promise<unknown>) => ctx.waitUntil(promise);
  if (path === '/api/v1/health' && request.method === 'GET' && env.DB) {
    const cache = await caches
      .open(`destiny-health-${env.CF_VERSION_METADATA?.id ?? 'local'}`)
      .catch(() => undefined);
    return finish(await workerHealth(env.DB, env.CACHE, cache, request, waitUntil), 'health');
  }
  if (!circuitBypass(path)) {
    const open = await circuitOpen(env.CACHE);
    gateMs = performance.now() - started;
    if (open) {
      const { maintenanceResponse } = await import('./circuit-gate');
      return finish(maintenanceResponse(request), 'maintenance');
    }
  }
  const scoped = (incoming: Request) => withDatabaseScope(() => dispatch(incoming), waitUntil);
  if (publicCacheRequest(request)) {
    // DESIGN-GAP: The deployment version namespaces edge objects so rollback/new deployments never reuse obsolete HTML.
    const cache = await caches
      .open(`destiny-public-${env.CF_VERSION_METADATA?.id ?? 'local'}`)
      .catch(() => undefined);
    return finish(
      cache ? await publicCachedFetch(request, cache, waitUntil, scoped) : await scoped(request),
      'public',
    );
  }
  return finish(await scoped(request), 'next');
}
