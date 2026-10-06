import type { KVNamespace } from '@cloudflare/workers-types';
import { circuitOpen, circuitBypass, maintenanceResponse } from './circuit-gate';
import { withDatabaseScope } from './database-scope';
export interface WorkerEnvironment {
  CACHE: KVNamespace;
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
  if (!circuitBypass(path) && (await circuitOpen(env.CACHE))) return maintenanceResponse(request);
  return withDatabaseScope(
    () => dispatch(request),
    (promise) => ctx.waitUntil(promise),
  );
}
