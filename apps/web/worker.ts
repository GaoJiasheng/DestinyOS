import {
  workerFetch,
  type WorkerEnvironment,
  type WorkerContext,
} from './lib/platform/worker-runtime';
import { scheduledMaintenance } from './lib/platform/scheduled';
/** Reuse OpenNext through the cost gate and request-scoped database cleanup. */
function fetchRequest(
  request: Request,
  env: WorkerEnvironment,
  ctx: WorkerContext,
): Promise<Response> {
  // DESIGN-GAP: Cache hits and health never initialize OpenNext's full application bundle.
  return workerFetch(request, env, ctx, async (incoming) => {
    const started = performance.now();
    const { default: handler } = await import('./.open-next/worker.js');
    const initialized = performance.now();
    const response = await handler.fetch(incoming, env, ctx);
    const headers = new Headers(response.headers);
    headers.append(
      'Server-Timing',
      `open-next-init;dur=${(initialized - started).toFixed(2)}, open-next;dur=${(performance.now() - initialized).toFixed(2)}`,
    );
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
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
