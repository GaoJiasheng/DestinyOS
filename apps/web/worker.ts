import handler from './.open-next/worker.js';
import { withDatabaseScope } from './lib/platform/database-scope';
import { scheduledMaintenance } from './lib/platform/scheduled';
interface WorkerEnvironment {
  CRON_SECRET?: string;
  NEXT_PUBLIC_SITE_URL?: string;
}
interface WorkerContext {
  waitUntil(promise: Promise<unknown>): void;
}
/** Reuse OpenNext fetch while owning request-scoped database cleanup through streaming completion. */
function fetchRequest(
  request: Request,
  env: WorkerEnvironment,
  ctx: WorkerContext,
): Promise<Response> {
  return withDatabaseScope(
    () => handler.fetch(request, env, ctx),
    (promise) => ctx.waitUntil(promise),
  );
}
export default {
  fetch: fetchRequest,
  async scheduled(_event: unknown, env: WorkerEnvironment, ctx: WorkerContext): Promise<void> {
    await scheduledMaintenance(env, (request) => fetchRequest(request, env, ctx));
  },
};
