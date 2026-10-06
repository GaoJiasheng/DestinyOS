import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { configureWaf, wafRule } from './cf-waf-ratelimit';
beforeEach(() => vi.stubEnv('CLOUDFLARE_ZONE_ID', undefined));
afterEach(() => vi.unstubAllEnvs());
it('dry run needs no token and performs no API calls', async () => {
  const fetcher = vi.fn();
  const result = await configureWaf({ dryRun: true, fetcher });
  expect(result).toMatchObject({
    zone: 'gavin.pub',
    rule: {
      action: 'block',
      ratelimit: { period: 10, requests_per_period: 60, mitigation_timeout: 10 },
    },
  });
  expect(fetcher).not.toHaveBeenCalled();
  expect(wafRule().expression).toContain('tianji.gavin.pub');
  expect(wafRule().expression).not.toContain('extension');
  expect(wafRule().expression).toContain('starts_with(http.request.uri.path, "/art/")');
});
it('uses the explicit zone ID without looking up zones', async () => {
  vi.stubEnv('CLOUDFLARE_ZONE_ID', 'isolated-zone');
  const fetcher = vi
    .fn<typeof fetch>()
    .mockResolvedValueOnce(new Response('', { status: 404 }))
    .mockResolvedValueOnce(Response.json({ success: true, result: {} }));
  await expect(configureWaf({ token: 'isolated', fetcher })).resolves.toMatchObject({
    result: 'configured',
  });
  expect(fetcher).toHaveBeenCalledTimes(2);
  expect(fetcher).toHaveBeenNthCalledWith(
    1,
    'https://api.cloudflare.com/client/v4/zones/isolated-zone/rulesets/phases/http_ratelimit/entrypoint',
    expect.objectContaining({ method: 'GET' }),
  );
});
it('updates only its existing rule and preserves neighboring rules', async () => {
  const fetcher = vi
    .fn<typeof fetch>()
    .mockResolvedValueOnce(
      Response.json({ success: true, result: [{ id: 'zone', name: 'gavin.pub' }] }),
    )
    .mockResolvedValueOnce(
      Response.json({
        success: true,
        result: {
          id: 'ruleset',
          rules: [
            { id: 'other', ref: 'another_rule' },
            { id: 'ours', ref: wafRule().ref },
          ],
        },
      }),
    )
    .mockResolvedValueOnce(Response.json({ success: true, result: {} }));
  await configureWaf({ token: 'isolated', fetcher });
  expect(fetcher).toHaveBeenLastCalledWith(
    'https://api.cloudflare.com/client/v4/zones/zone/rulesets/ruleset/rules/ours',
    expect.objectContaining({ method: 'PATCH' }),
  );
});
it('creates an entrypoint when absent and propagates failures', async () => {
  const fetcher = vi
    .fn<typeof fetch>()
    .mockResolvedValueOnce(
      Response.json({ success: true, result: [{ id: 'zone', name: 'gavin.pub' }] }),
    )
    .mockResolvedValueOnce(new Response('', { status: 404 }))
    .mockResolvedValueOnce(Response.json({ success: true, result: {} }));
  await configureWaf({ token: 'isolated', fetcher });
  expect(fetcher).toHaveBeenLastCalledWith(
    'https://api.cloudflare.com/client/v4/zones/zone/rulesets',
    expect.objectContaining({ method: 'POST' }),
  );
  await expect(configureWaf({ fetcher })).rejects.toThrow('CLOUDFLARE_API_TOKEN');
});
