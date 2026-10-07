import worker from '../worker';
import type { WorkerEnvironment, WorkerContext } from '../lib/platform/worker-runtime';
/** Local test controls bypass the production cost gate; normal traffic runs the real primary entry. */
export default {
  fetch(
    request: Request,
    env: WorkerEnvironment & { MEDIA: { fetch(request: Request): Promise<Response> } },
    ctx: WorkerContext,
  ) {
    if (new URL(request.url).pathname.startsWith('/_smoke/media/')) {
      const url = new URL(request.url);
      url.pathname = url.pathname.replace('/_smoke/media', '');
      return env.MEDIA.fetch(new Request(url, request));
    }
    if (new URL(request.url).pathname.startsWith('/_smoke/')) return env.COMPUTE!.fetch(request);
    return worker.fetch(request, env, ctx);
  },
};
