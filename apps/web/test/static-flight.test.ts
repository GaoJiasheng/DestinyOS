// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { staticFlightUrl, installStaticFlightFetch, staticActionUrl } from '../lib/static-flight';
import { isStaticPublicPath } from '../lib/static-public-path';
afterEach(() => vi.unstubAllGlobals());
it('uses static Flight for public navigation, preserving private/action/query requests', () => {
  const url = `${location.origin}/zh/learn/bazi`;
  expect(
    staticFlightUrl(`${url}?_rsc=token`, {
      headers: { RSC: '1', 'Next-Router-State-Tree': 'tree' },
    })?.href,
  ).toBe(`${url}.rsc`);
  for (const [path, init] of [
    ['/zh/me', { headers: { RSC: '1' } }],
    ['/zh', { headers: { RSC: '1', 'Next-Action': 'id' }, method: 'POST' }],
    ['/zh?private=1', { headers: { RSC: '1' } }],
    ['/zh', {}],
    ['/zh/learn/unknown', { headers: { RSC: '1' } }],
    ['https://external.test/zh', { headers: { RSC: '1' } }],
  ] as const)
    expect(staticFlightUrl(path, init)).toBeNull();
  expect(
    staticFlightUrl('/zh/today?date=2026-10-14&_rsc=token', { headers: { RSC: '1' } })?.pathname,
  ).toBe('/zh/today.rsc');
  expect(isStaticPublicPath('/en/synastry')).toBe(true);
  expect(isStaticPublicPath('/zh/bazi/new')).toBe(false);
});
it('maps Next 16 segment prefetches to their build files and rejects unsafe keys', () => {
  const segment = (value: string) =>
    staticFlightUrl(`${location.origin}/zh?_rsc=token`, {
      headers: { RSC: '1', 'Next-Router-Prefetch': '1', 'Next-Router-Segment-Prefetch': value },
    })?.pathname;
  expect(segment('/_tree')).toBe('/zh._tree.segment.rsc');
  expect(segment('/$d$locale/!KG1hcmtldGluZyk/__PAGE__')).toBe(
    '/zh.$d$locale.!KG1hcmtldGluZyk.__PAGE__.segment.rsc',
  );
  expect(segment('/_full')).toBe('/zh.rsc');
  expect(segment('/../secret')).toBeUndefined();
});
it('installs before prefetch, retains Request options and preserves private actions', async () => {
  const fetch = vi.fn(async () => new Response('flight'));
  vi.stubGlobal('fetch', fetch);
  installStaticFlightFetch();
  const request = new Request(`${location.origin}/zh?_rsc=token`, { headers: { RSC: '1' } });
  const response = await window.fetch(request);
  expect(response.url).toBe(request.url);
  expect((fetch.mock.calls[0] as unknown as [Request])[0].url).toBe(`${location.origin}/zh.rsc`);
  const action = new Request(`${location.origin}/zh`, {
    method: 'POST',
    headers: { 'Next-Action': 'id' },
  });
  await window.fetch(action);
  expect((fetch.mock.calls[1] as unknown as [Request])[0].url).toBe(
    `${location.origin}/_actions/zh`,
  );
  expect(
    staticActionUrl(`${location.origin}/zh/me`, {
      method: 'POST',
      headers: { 'Next-Action': 'id' },
    }),
  ).toBeNull();
});
