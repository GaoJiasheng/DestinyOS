import {
  workerFetch,
  type WorkerEnvironment,
  type WorkerContext,
} from './lib/platform/worker-runtime';
import { scheduledMaintenance } from './lib/platform/scheduled';
import { publicArtifact, publicActionRequest } from './lib/platform/public-artifact';
/** Small entry serves public build artifacts without importing Next, Prisma, engines or media. */
async function fetchRequest(
  request: Request,
  env: WorkerEnvironment,
  ctx: WorkerContext,
): Promise<Response> {
  // DESIGN-GAP: Missing/stale example snapshots fall back to the page's pure client engine, without booting Next for an asset 404.
  if (request.method === 'GET' && new URL(request.url).pathname.startsWith('/_data/daily-example/'))
    return new Response(null, { status: 404, headers: { 'Cache-Control': 'public, max-age=300' } });
  if (new URL(request.url).pathname.startsWith('/_actions/'))
    request = publicActionRequest(request) ?? request;
  if (/^\/api\/v1\/mobile(?:\/|$)/.test(new URL(request.url).pathname)) {
    // DESIGN-GAP: Compute alone handles mobile authentication, maintenance and callbacks; never cache native traffic at the public entry.
    const response = env.COMPUTE
      ? await env.COMPUTE.fetch(request)
      : Response.json(
          { ok: false, error: { code: 'E_INTERNAL', message: 'Mobile service unavailable' } },
          { status: 503 },
        );
    const headers = new Headers(response.headers);
    headers.set('Cache-Control', 'private, no-store');
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  }
  return workerFetch(request, env, ctx, async (incoming) => {
    const artifact = env.ASSETS ? await publicArtifact(incoming, env.ASSETS) : null;
    if (artifact) return artifact;
    if (!env.COMPUTE) return new Response(null, { status: 503 });
    return env.COMPUTE.fetch(incoming);
  });
}
export default {
  fetch: fetchRequest,
  async scheduled(
    event: { cron: string },
    env: WorkerEnvironment,
    ctx: WorkerContext,
  ): Promise<void> {
    await scheduledMaintenance(env, (request) => fetchRequest(request, env, ctx), event.cron);
  },
};
