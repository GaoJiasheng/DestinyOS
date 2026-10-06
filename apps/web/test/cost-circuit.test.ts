import { describe, expect, it, vi } from 'vitest';
import { billingCycleStart, nextCircuit } from '../lib/circuit-state';
import { checkCostCircuit, workersUsage } from '../lib/cost-circuit';
import { circuitBypass, circuitOpen, maintenanceResponse } from '../lib/platform/circuit-gate';
function store() {
  const values = new Map<string, string>();
  return {
    values,
    get: vi.fn(async (key: string) => values.get(key) ?? null),
    put: vi.fn(async (key: string, value: string) => {
      values.set(key, value);
    }),
  };
}
function analytics(requests: number, cpuMs: number) {
  return Response.json({
    data: {
      viewer: {
        accounts: [
          { workersInvocationsAdaptive: [{ sum: { requests, cpuTimeUs: cpuMs * 1000 } }] },
        ],
      },
    },
    errors: null,
  });
}
const now = new Date('2026-10-01T01:00:00Z');
const env = {
  CF_ANALYTICS_TOKEN: 'isolated-token',
  CF_ANALYTICS_ACCOUNT_ID: 'account',
  ADMIN_EMAILS: 'first@example.test, second@example.test',
};
describe('billing cost thresholds', () => {
  it('opens only above either 90%, preserves the deadband and requires both dimensions below 80%', () => {
    expect(nextCircuit(null, 'oct', { requests: 9_000_000, cpuMs: 27_000_000 }).open).toBe(false);
    for (const usage of [
      { requests: 9_000_001, cpuMs: 0 },
      { requests: 0, cpuMs: 27_000_001 },
    ])
      expect(nextCircuit(null, 'oct', usage).open).toBe(true);
    const previous = { cycle: 'oct', open: true, notified: [] };
    expect(nextCircuit(previous, 'oct', { requests: 8_000_000, cpuMs: 0 }).open).toBe(true);
    expect(nextCircuit(previous, 'oct', { requests: 0, cpuMs: 24_000_000 }).open).toBe(true);
    expect(nextCircuit(previous, 'oct', { requests: 7_999_999, cpuMs: 23_999_999 }).open).toBe(
      false,
    );
    expect(nextCircuit(previous, 'nov', { requests: 8_500_000, cpuMs: 0 }).open).toBe(false);
  });
  it('uses UTC invoice anniversary and clamps short months', () => {
    expect(billingCycleStart(new Date('2026-03-01T00:00:00Z'), 31).toISOString()).toBe(
      '2026-02-28T00:00:00.000Z',
    );
    expect(billingCycleStart(new Date('2026-10-06T00:00:00Z'), 5).toISOString()).toBe(
      '2026-10-05T00:00:00.000Z',
    );
    expect(() => billingCycleStart(now, 0)).toThrow();
  });
});
it('skips without a token, with no fetch, KV reads/writes or email', async () => {
  const kv = store(),
    notify = vi.fn(),
    fetcher = vi.fn();
  expect(await checkCostCircuit({}, { store: kv, notify, fetcher, now })).toEqual({
    result: 'skipped',
  });
  expect(kv.get).not.toHaveBeenCalled();
  expect(kv.put).not.toHaveBeenCalled();
  expect(fetcher).not.toHaveBeenCalled();
  expect(notify).not.toHaveBeenCalled();
});
it('trips before email, retries only failed recipients, and restores on a new cycle', async () => {
  const kv = store();
  const fetcher = vi.fn<typeof fetch>().mockImplementation(async () => analytics(9_000_001, 0));
  const notify = vi.fn(async (recipient: string) => {
    expect(kv.values.get('circuit')).toBe('open');
    if (recipient.startsWith('second')) throw new Error('mail failed');
  });
  await expect(checkCostCircuit(env, { store: kv, notify, fetcher, now })).rejects.toThrow();
  notify.mockImplementation(async () => {});
  await checkCostCircuit(env, { store: kv, notify, fetcher, now });
  expect(notify.mock.calls.map(([recipient]) => recipient)).toEqual([
    'first@example.test',
    'second@example.test',
    'second@example.test',
  ]);
  await checkCostCircuit(env, { store: kv, notify, fetcher, now });
  expect(notify).toHaveBeenCalledTimes(3);
  fetcher.mockImplementation(async () => analytics(0, 0));
  await checkCostCircuit(env, {
    store: kv,
    notify,
    fetcher,
    now: new Date('2026-11-01T01:00:00Z'),
  });
  expect(kv.values.get('circuit')).toBe('closed');
});
it('sums all scripts in non-overlapping slices, converts CPU units and rejects GraphQL errors', async () => {
  const fetcher = vi.fn<typeof fetch>().mockImplementation(async () => analytics(100, 123));
  expect(
    await workersUsage('token', 'account', now, new Date('2026-10-03T02:00:00Z'), fetcher),
  ).toEqual({ requests: 300, cpuMs: 369 });
  const inputs = fetcher.mock.calls.map(
    ([, input]) => JSON.parse(String(input?.body)) as { variables: { start: string; end: string } },
  );
  expect(inputs[0]?.variables.end).toBe(inputs[1]?.variables.start);
  expect(String(fetcher.mock.calls[0]?.[1]?.body)).not.toContain('scriptName');
  fetcher.mockResolvedValue(Response.json({ errors: [{ message: 'field unavailable' }] }));
  await expect(
    workersUsage('token', 'account', now, new Date('2026-10-01T02:00:00Z'), fetcher),
  ).rejects.toThrow('Analytics query failed');
});
it('does not reopen or clear existing state on provider error', async () => {
  const kv = store();
  kv.values.set('circuit', 'open');
  const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response('', { status: 503 }));
  await expect(
    checkCostCircuit(env, { store: kv, notify: vi.fn(), fetcher, now }),
  ).rejects.toThrow();
  expect(kv.put).not.toHaveBeenCalled();
});
it('manual mode overrides automatic status and costly URLs never bypass', async () => {
  const kv = store();
  kv.values.set('circuit', 'open');
  expect(await circuitOpen(kv)).toBe(true);
  kv.values.set('circuit:mode', 'closed');
  expect(await circuitOpen(kv)).toBe(false);
  kv.values.set('circuit:mode', 'open');
  kv.values.set('circuit', 'closed');
  expect(await circuitOpen(kv)).toBe(true);
  for (const path of [
    '/api/export',
    '/api/v1/readings/a/chat',
    '/api/v1/og/share/a',
    '/api/v1/og/daily',
    '/zh/today',
    '/en/pricing',
  ])
    expect(circuitBypass(path)).toBe(false);
  for (const path of [
    '/admin/config',
    '/zh-TW/auth/login',
    '/api/auth/callback/google',
    '/api/v1/cron/cost-circuit',
    '/api/v1/cron/daily-maintenance',
  ])
    expect(circuitBypass(path)).toBe(true);
  expect(circuitBypass('/api/v1/cron/cost-circuit/evil')).toBe(false);
});
it.each(['zh', 'zh-TW', 'en'])('serves a static translated 503 in %s', async (locale) => {
  const response = maintenanceResponse(new Request(`https://example.test/${locale}/today`));
  expect(response.status).toBe(503);
  const html = await response.text();
  expect(html).toContain(`lang="${locale}"`);
  expect(html).not.toContain('<script');
  expect(response.headers.get('cache-control')).toBe('no-store');
});
