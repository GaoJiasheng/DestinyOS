import { z } from 'zod';
import { billingCycleStart, nextCircuit, type CircuitState, type Usage } from './circuit-state';
import type { CircuitStore } from './platform/circuit-gate';
import { logger } from './logger';
const stateSchema = z.object({
  cycle: z.string(),
  open: z.boolean(),
  notified: z.array(z.string()),
});
const analyticsSchema = z.object({
  errors: z.array(z.unknown()).nullish(),
  data: z
    .object({
      viewer: z.object({
        accounts: z
          .array(
            z.object({
              workersInvocationsAdaptive: z.array(
                z.object({
                  sum: z.object({
                    requests: z.number().nonnegative(),
                    cpuTimeUs: z.number().nonnegative(),
                  }),
                }),
              ),
            }),
          )
          .length(1),
      }),
    })
    .nullish(),
});
export interface CircuitEnvironment {
  CF_ANALYTICS_TOKEN?: string;
  CF_ANALYTICS_ACCOUNT_ID?: string;
  CF_BILLING_CYCLE_DAY?: string;
  ADMIN_EMAILS?: string;
}
/** Query aggregate account usage in daily slices; CPU microseconds are converted to milliseconds. */
// DESIGN-GAP: Account-wide allowance is shared by Workers; sum all scripts. Daily slices avoid dataset window limits; no quantile-times-count approximation.
export async function workersUsage(
  token: string,
  account: string,
  start: Date,
  end: Date,
  fetcher: typeof fetch = fetch,
): Promise<Usage> {
  const usage: Usage = { requests: 0, cpuMs: 0 };
  for (let from = start.getTime(); from < end.getTime(); from += 86400000) {
    const response = await fetcher('https://api.cloudflare.com/client/v4/graphql', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `query Usage($account: string!, $start: Time!, $end: Time!) { viewer { accounts(filter: {accountTag: $account}) { workersInvocationsAdaptive(limit: 1, filter: {datetime_geq: $start, datetime_lt: $end}) { sum { requests cpuTimeUs } } } } }`,
        variables: {
          account,
          start: new Date(from).toISOString(),
          end: new Date(Math.min(from + 86400000, end.getTime())).toISOString(),
        },
      }),
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) throw new Error('Analytics request failed');
    const parsed = analyticsSchema.parse(await response.json());
    if (parsed.errors?.length || !parsed.data) throw new Error('Analytics query failed');
    for (const row of parsed.data.viewer.accounts[0]!.workersInvocationsAdaptive) {
      usage.requests += row.sum.requests;
      usage.cpuMs += row.sum.cpuTimeUs / 1000;
    }
  }
  return usage;
}
/** Check usage and durably trip before alert delivery. Failed recipients retry on the next hourly run. */
export async function checkCostCircuit(
  env: CircuitEnvironment,
  dependencies: {
    store: CircuitStore;
    notify: (recipient: string, usage: Usage) => Promise<void>;
    fetcher?: typeof fetch;
    now?: Date;
  },
) {
  if (!env.CF_ANALYTICS_TOKEN || !env.CF_ANALYTICS_ACCOUNT_ID) {
    logger.warn({ reason: 'missing_analytics_configuration' }, 'Cost circuit check skipped');
    return { result: 'skipped' as const };
  }
  const now = dependencies.now ?? new Date();
  const start = billingCycleStart(now, Number(env.CF_BILLING_CYCLE_DAY ?? '1'));
  const usage = await workersUsage(
    env.CF_ANALYTICS_TOKEN,
    env.CF_ANALYTICS_ACCOUNT_ID,
    start,
    now,
    dependencies.fetcher,
  );
  const raw = await dependencies.store.get('circuit:state');
  const previous = raw ? stateSchema.parse(JSON.parse(raw)) : null;
  const state: CircuitState = nextCircuit(previous, start.toISOString(), usage);
  await dependencies.store.put('circuit', state.open ? 'open' : 'closed');
  await dependencies.store.put('circuit:state', JSON.stringify(state));
  await dependencies.store.put(
    'circuit:usage',
    JSON.stringify({ ...usage, checkedAt: now.toISOString(), cycle: state.cycle }),
  );
  if (state.open && (await dependencies.store.get('circuit:mode')) !== 'closed') {
    for (const recipient of (env.ADMIN_EMAILS ?? '')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean)) {
      if (state.notified.includes(recipient)) continue;
      await dependencies.notify(recipient, usage);
      state.notified.push(recipient);
      await dependencies.store.put('circuit:state', JSON.stringify(state));
    }
  }
  return { result: state.open ? ('open' as const) : ('closed' as const), usage };
}
