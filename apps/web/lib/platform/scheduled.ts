export const maintenancePath = '/api/v1/cron/daily-maintenance';
/** Dispatch Cron through OpenNext's request context into the same authenticated maintenance function. */
// DESIGN-GAP: OpenNext establishes env/AsyncLocalStorage in fetch; scheduled jobs enter through that handler without a public network request.
export async function scheduledMaintenance(
  env: { CRON_SECRET?: string; NEXT_PUBLIC_SITE_URL?: string },
  dispatch: (request: Request) => Promise<Response>,
): Promise<void> {
  if (!env.CRON_SECRET) throw new Error('Cron secret missing');
  const response = await dispatch(
    new Request(new URL(maintenancePath, env.NEXT_PUBLIC_SITE_URL ?? 'https://tianji.gavin.pub'), {
      headers: { authorization: `Bearer ${env.CRON_SECRET}` },
    }),
  );
  await response.arrayBuffer();
  if (!response.ok) throw new Error('Daily maintenance failed');
}
