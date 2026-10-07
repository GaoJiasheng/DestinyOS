import {
  workerFetch,
  type WorkerEnvironment,
  type WorkerContext,
} from './lib/platform/worker-runtime';
import { scheduledMaintenance } from './lib/platform/scheduled';
import { publicArtifact } from './lib/platform/public-artifact';
/** Small entry serves public build artifacts without importing Next, Prisma, engines or media. */
function fetchRequest(
  request: Request,
  env: WorkerEnvironment,
  ctx: WorkerContext,
): Promise<Response> {
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
