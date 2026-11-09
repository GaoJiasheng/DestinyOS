export const maintenancePath = '/api/v1/cron/daily-maintenance';
const costCircuitPath = '/api/v1/cron/cost-circuit';
const webPushPath = '/api/v1/cron/web-push';
/** Dispatch Cron through OpenNext's request context into the same authenticated maintenance function. */
// DESIGN-GAP: OpenNext establishes env/AsyncLocalStorage in fetch; scheduled jobs enter through that handler without a public network request.
export async function scheduledMaintenance(
  env: { CRON_SECRET?: string; NEXT_PUBLIC_SITE_URL?: string; FEATURE_WEB_PUSH?: string },
  dispatch: (request: Request) => Promise<Response>,
  cron = '0 3 * * *',
): Promise<void> {
  if (!env.CRON_SECRET) throw new Error('Cron secret missing');
  // The cost check runs first so a tripped circuit is already visible to the web-push run.
  const paths =
    cron === '0 * * * *'
      ? [costCircuitPath, ...(env.FEATURE_WEB_PUSH === 'true' ? [webPushPath] : [])]
      : [maintenancePath];
  let failed = false;
  for (const path of paths) {
    try {
      const response = await dispatch(
        new Request(new URL(path, env.NEXT_PUBLIC_SITE_URL ?? 'https://tianji.gavin.pub'), {
          headers: { authorization: `Bearer ${env.CRON_SECRET}` },
        }),
      );
      await response.arrayBuffer();
      if (!response.ok) failed = true;
    } catch {
      failed = true;
    }
  }
  if (failed) throw new Error('Daily maintenance failed');
}
