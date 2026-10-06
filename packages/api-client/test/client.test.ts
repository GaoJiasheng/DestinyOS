import { expect, it, vi } from 'vitest';
import { z } from 'zod';
import { createApiClient, ApiClientError, type ApiEndpoint } from '../src/index';
import {
  GeoSearchRequestSchema,
  GeoTimezoneRequestSchema,
  ReadingRequestSchema,
} from '@tianji/shared';

const city = {
  name: 'Singapore',
  country: 'SG',
  admin: 'SG',
  lat: 1.29,
  lng: 103.85,
  tz: 'Asia/Singapore',
};
const reply = (data: unknown) => Response.json({ ok: true, data });

it('uses the same Web route, abort signal and cookie policy with schema-derived city results', async () => {
  const transport = vi.fn<typeof fetch>().mockResolvedValue(reply([city]));
  const client = createApiClient({ fetch: transport });
  const signal = new AbortController().signal;
  expect(await client.searchCities({ q: 'Singapore', locale: 'en' }, { signal })).toEqual([city]);
  expect(transport).toHaveBeenCalledWith(
    '/api/v1/geo/search?q=Singapore&locale=en',
    expect.objectContaining({ method: 'GET', credentials: 'same-origin', signal }),
  );
  expect(GeoSearchRequestSchema.parse({ q: '  星  ' })).toEqual({ q: '星', locale: 'zh' });
});

it('shares timezone coercion and bounds with server validation and retains zh-TW', async () => {
  const transport = vi.fn<typeof fetch>().mockResolvedValue(reply({ tz: 'Asia/Singapore' }));
  const client = createApiClient({ fetch: transport });
  expect(await client.lookupTimezone({ lat: ' 1.29 ', lng: '103.85' })).toEqual({
    tz: 'Asia/Singapore',
  });
  expect(transport).toHaveBeenCalledWith('/api/v1/geo/tz?lat=1.29&lng=103.85', expect.any(Object));
  for (const lat of ['', 'NaN', '91', '-91'])
    expect(GeoTimezoneRequestSchema.safeParse({ lat, lng: '0' }).success).toBe(false);
  expect(GeoTimezoneRequestSchema.safeParse({ lat: '0', lng: '181' }).success).toBe(false);
  expect(GeoSearchRequestSchema.parse({ q: '星', locale: 'zh-TW' }).locale).toBe('zh-TW');
  expect(GeoSearchRequestSchema.safeParse({ q: '' }).success).toBe(false);
  expect(GeoSearchRequestSchema.safeParse({ q: 'a'.repeat(101) }).success).toBe(false);
});

it('supports current Bearer credentials and JSON mutations with shared reading input without retries', async () => {
  const transport = vi
    .fn<typeof fetch>()
    .mockImplementation(async () => reply({ readingId: 'r1' }));
  let current = 'first';
  const client = createApiClient({
    baseUrl: 'https://tianji.gavin.pub/',
    fetch: transport,
    accessToken: async () => current,
  });
  // DESIGN-GAP: A synthetic transport contract exercises future mobile JSON endpoints without adding an unimplemented server route.
  const endpoint = {
    path: '/api/v1/mobile/test',
    method: 'POST',
    input: ReadingRequestSchema,
    output: z.object({ readingId: z.string() }),
    encode: (input) => ({ body: input }),
  } satisfies ApiEndpoint<typeof ReadingRequestSchema, z.ZodType<{ readingId: string }>>;
  const request = {
    system: 'bazi' as const,
    idempotencyKey: '90a07130-6183-4b15-b43c-17483b01414e',
  };
  expect(
    await client.request(endpoint, request, { idempotencyKey: request.idempotencyKey }),
  ).toEqual({ readingId: 'r1' });
  current = 'second';
  await client.request(endpoint, request);
  expect(transport).toHaveBeenLastCalledWith(
    'https://tianji.gavin.pub/api/v1/mobile/test',
    expect.objectContaining({
      credentials: 'omit',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: 'Bearer second',
      },
      body: expect.any(String),
    }),
  );
  expect(JSON.parse(String(transport.mock.calls[1]![1]?.body))).toEqual({
    ...request,
    locale: 'zh',
  });
  expect(transport).toHaveBeenCalledTimes(2);
  expect(transport.mock.calls[0]![1]?.headers).toHaveProperty(
    'Idempotency-Key',
    request.idempotencyKey,
  );
});

it('never uses Web cookies for anonymous native requests', async () => {
  const transport = vi.fn<typeof fetch>().mockResolvedValue(reply([]));
  await createApiClient({ baseUrl: 'https://tianji.gavin.pub', fetch: transport }).searchCities({
    q: 'Singapore',
  });
  expect(transport.mock.calls[0]![1]?.credentials).toBe('omit');
});

it('fails invalid input before fetch without keeping sensitive values in the error', async () => {
  const transport = vi.fn<typeof fetch>();
  const client = createApiClient({ fetch: transport });
  await expect(client.lookupTimezone({ lat: '', lng: '0' })).rejects.toMatchObject({
    code: 'E_VALIDATION',
    status: 0,
    kind: 'validation',
  });
  expect(transport).not.toHaveBeenCalled();
});

it.each([
  reply([{ ...city, lat: 'invalid' }]),
  Response.json({ ok: true, data: [city] }, { status: 500 }),
  new Response('not JSON'),
])('rejects invalid/unexpected responses', async (response) => {
  const client = createApiClient({ fetch: vi.fn<typeof fetch>().mockResolvedValue(response) });
  await expect(client.searchCities({ q: 'Singapore' })).rejects.toBeInstanceOf(ApiClientError);
});

it('preserves API error codes, details and retry-after without retaining developer text', async () => {
  const transport = vi.fn<typeof fetch>().mockResolvedValue(
    Response.json(
      {
        ok: false,
        error: {
          code: 'E_RATE_LIMITED',
          message: 'private developer text',
          details: { retryAfter: 30 },
        },
      },
      { status: 429, headers: { 'Retry-After': '30' } },
    ),
  );
  const client = createApiClient({ fetch: transport });
  await expect(client.searchCities({ q: 'Singapore' })).rejects.toMatchObject({
    code: 'E_RATE_LIMITED',
    status: 429,
    details: { retryAfter: 30 },
    retryAfter: 30,
    message: 'API request failed',
  });
  expect(transport).toHaveBeenCalledTimes(1);
});

it('keeps cancellation/network failures and first-party origins under platform control', async () => {
  const aborted = new DOMException('Aborted', 'AbortError');
  const transport = vi.fn<typeof fetch>().mockRejectedValue(aborted);
  await expect(createApiClient({ fetch: transport }).searchCities({ q: 'Singapore' })).rejects.toBe(
    aborted,
  );
  for (const origin of [
    'http://external.example',
    'https://user:password@tianji.gavin.pub',
    'https://tianji.gavin.pub/path',
    'https://tianji.gavin.pub?token=x',
  ])
    expect(() => createApiClient({ baseUrl: origin })).toThrow('Invalid API origin');
  expect(() => createApiClient({ baseUrl: 'http://127.0.0.1:3000' })).not.toThrow();
});
