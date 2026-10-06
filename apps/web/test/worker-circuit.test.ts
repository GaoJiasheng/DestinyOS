import { expect, it, vi } from 'vitest';
import type { KVNamespace } from '@cloudflare/workers-types';
const dispatch = vi.hoisted(() =>
  vi.fn(
    async (request: Request) =>
      new Response('ok', { headers: { 'X-Test-Path': new URL(request.url).pathname } }),
  ),
);
import { workerFetch } from '../lib/platform/worker-runtime';
import { scheduledMaintenance } from '../lib/platform/scheduled';
it('stops the entire public site and expensive routes before Next.js, and leaves recovery reachable', async () => {
  const cache = {
    get: vi.fn(async (key: string) => (key === 'circuit' ? 'open' : null)),
  } as unknown as KVNamespace;
  const env = { CACHE: cache, FEATURE_WEB_PAYMENTS: 'false' };
  const context = {
    waitUntil: (promise: Promise<unknown>) => {
      void promise;
    },
  };
  for (const path of [
    '/zh',
    '/zh-TW/pricing',
    '/en/me/billing',
    '/api/export',
    '/api/v1/readings/a/chat',
    '/api/v1/og/daily',
    '/api/v1/og/share/a',
  ]) {
    const response = await workerFetch(
      new Request(`https://example.test${path}`),
      env,
      context,
      dispatch,
    );
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain('<script');
  }
  expect(dispatch).not.toHaveBeenCalled();
  expect(
    (
      await workerFetch(
        new Request('https://example.test/api/v1/stripe/webhook'),
        env,
        context,
        dispatch,
      )
    ).status,
  ).toBe(404);
  const admin = await workerFetch(
    new Request('https://example.test/admin/config'),
    env,
    context,
    dispatch,
  );
  expect(await admin.text()).toBe('ok');
  expect(dispatch).toHaveBeenCalledOnce();
});
it('dispatches daily and hourly jobs independently even during maintenance', async () => {
  dispatch.mockClear();
  const env = {
    CACHE: { get: async () => 'open' } as unknown as KVNamespace,
    CRON_SECRET: 'isolated-cron',
  };
  const context = {
    waitUntil: (promise: Promise<unknown>) => {
      void promise;
    },
  };
  await scheduledMaintenance(
    env,
    (request) => workerFetch(request, env, context, dispatch),
    '0 * * * *',
  );
  await scheduledMaintenance(
    env,
    (request) => workerFetch(request, env, context, dispatch),
    '0 3 * * *',
  );
  expect(
    dispatch.mock.calls.map((call) => new URL((call[0] as unknown as Request).url).pathname),
  ).toEqual(['/api/v1/cron/cost-circuit', '/api/v1/cron/daily-maintenance']);
});

it('keeps mobile login and universal confirmation reachable while returning JSON for paused mobile data APIs', async () => {
  const cache = { get: async () => 'open' } as unknown as KVNamespace;
  const env = { CACHE: cache };
  const context = {
    waitUntil: (promise: Promise<unknown>) => {
      void promise;
    },
  };
  const blocked = await workerFetch(
    new Request('https://example.test/api/v1/mobile/sync/profiles'),
    env,
    context,
    dispatch,
  );
  expect(blocked.status).toBe(503);
  expect(blocked.headers.get('Content-Type')).toContain('application/json');
  expect(await blocked.json()).toMatchObject({ ok: false, error: { code: 'E_INTERNAL' } });
  for (const path of ['/api/v1/mobile/auth/refresh', '/auth/verify'])
    expect(
      (await workerFetch(new Request(`https://example.test${path}`), env, context, dispatch))
        .status,
    ).toBe(200);
});
