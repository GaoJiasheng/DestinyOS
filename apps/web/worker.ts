import handler from './.open-next/worker.js';
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
  return workerFetch(request, env, ctx, (incoming) => handler.fetch(incoming, env, ctx));
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
