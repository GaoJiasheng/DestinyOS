import { expect, it, vi } from 'vitest';
import type { KVNamespace } from '@cloudflare/workers-types';
import worker from '../worker';
import { circuitBypass } from '../lib/platform/circuit-policy';
vi.mock('../lib/platform/public-artifact', () => ({ publicArtifact: vi.fn() }));

it.each([
  ['GET', 'auth/sessions'],
  ['GET', 'knowledge/manifest'],
  ['PUT', 'sync/settings'],
  ['DELETE', 'auth/sessions/device-1'],
  ['POST', 'webhooks/revenuecat'],
  ['POST', 'chat/reading-1'],
])(
  'forwards %s %s unchanged to compute without consulting public cache, KV or assets',
  async (method, path) => {
    const incoming = new Request(
      `https://example.test/api/v1/mobile/${path}?since=opaque%2Bcursor`,
      {
        method,
        headers: {
          Authorization: 'Bearer credential',
          'Content-Type': 'application/json',
          'X-RevenueCat-Webhook-Signature': 'signed',
        },
        ...(method === 'GET' ? {} : { body: '{ "raw": "preserve whitespace" }' }),
      },
    );
    const get = vi.fn(async () => {
      throw new Error('main must not read KV');
    });
    const assets = vi.fn(async () => {
      throw new Error('main must not serve mobile assets');
    });
    const compute = vi.fn(async (request: Request) => {
      expect(request).toBe(incoming);
      expect(request.url).toContain('since=opaque%2Bcursor');
      expect(request.headers.get('Authorization')).toBe('Bearer credential');
      expect(request.headers.get('X-RevenueCat-Webhook-Signature')).toBe('signed');
      if (method !== 'GET') expect(await request.text()).toBe('{ "raw": "preserve whitespace" }');
      return new Response('streamed result', {
        status: 201,
        headers: {
          'Content-Type': 'application/x-ndjson',
          'Cache-Control': 'public, max-age=3600',
          'Retry-After': '60',
        },
      });
    });
    const response = await worker.fetch(
      incoming,
      {
        CACHE: { get } as unknown as KVNamespace,
        ASSETS: { fetch: assets },
        COMPUTE: { fetch: compute },
      },
      { waitUntil: vi.fn() },
    );
    expect(response.status).toBe(201);
    expect(response.headers.get('Content-Type')).toBe('application/x-ndjson');
    expect(response.headers.get('Retry-After')).toBe('60');
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
    expect(await response.text()).toBe('streamed result');
    expect(compute).toHaveBeenCalledOnce();
    expect(get).not.toHaveBeenCalled();
    expect(assets).not.toHaveBeenCalled();
  },
);
it('returns a noncacheable native error when compute is unavailable', async () => {
  const response = await worker.fetch(
    new Request('https://example.test/api/v1/mobile/auth/sessions'),
    { CACHE: {} as KVNamespace },
    { waitUntil: vi.fn() },
  );
  expect(response.status).toBe(503);
  expect(response.headers.get('Cache-Control')).toBe('private, no-store');
  expect(await response.json()).toMatchObject({ ok: false, error: { code: 'E_INTERNAL' } });
});
it('keeps native authentication, universal-link verification and signed callbacks reachable during maintenance', () => {
  for (const path of [
    '/api/v1/mobile/auth/refresh',
    '/api/v1/mobile/webhooks/revenuecat',
    '/auth/verify',
  ])
    expect(circuitBypass(path)).toBe(true);
  for (const path of [
    '/api/v1/mobile/sync/profiles',
    '/api/v1/mobile/knowledge/manifest',
    '/api/v1/mobile/authenticated',
  ])
    expect(circuitBypass(path)).toBe(false);
});
