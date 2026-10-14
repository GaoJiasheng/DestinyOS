import assert from 'node:assert/strict';
import { z } from 'zod';
const fixtureSchema = z.object({
  userId: z.string(),
  sessionId: z.string(),
  accessToken: z.string(),
  refreshToken: z.string(),
});
const envelopeSchema = z.object({
  ok: z.boolean(),
  data: z.unknown().optional(),
  error: z.object({ code: z.string() }).optional(),
});
/** Exercise real mobile routes through main → compute with isolated D1 credentials and callback configuration. */
export async function mobileMultiSmoke(base: string) {
  const checks: string[] = [];
  const mobile = async (path: string, status: number, options: RequestInit = {}) => {
    const response = await fetch(`${base}/api/v1/mobile/${path}`, options);
    const raw = await response.text();
    assert.equal(response.status, status, `${path}: ${raw.slice(0, 400)}`);
    assert.ok(
      response.headers.get('Content-Type')?.includes('application/json'),
      `${path}: JSON envelope required`,
    );
    const value: unknown = JSON.parse(raw);
    assert.equal(response.headers.get('Cache-Control'), 'private, no-store');
    assert.equal(response.headers.get('X-Destiny-Cache'), null);
    assert.equal(response.headers.get('X-Destiny-Renderer'), null);
    // Compute's OpenNext timing proves that the real API ran in the bound application Worker.
    if (status !== 503) assert.match(response.headers.get('Server-Timing') ?? '', /open-next/);
    checks.push(`${options.method ?? 'GET'} ${path}: ${status}`);
    return envelopeSchema.parse(value);
  };
  const json = (value: unknown, token?: string, method = 'POST'): RequestInit => ({
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(value),
  });
  // DESIGN-GAP: Substitute local email delivery while exercising the real single-use mobile verification endpoint.
  const magic = z
    .object({ url: z.string() })
    .parse(await (await fetch(`${base}/_smoke/mobile-magic`, { method: 'POST' })).json());
  const magicUrl = new URL(magic.url);
  const magicInput = {
    email: magicUrl.searchParams.get('email'),
    token: magicUrl.searchParams.get('token'),
    locale: 'zh',
    platform: 'ios',
    deviceName: 'IOS-BUILD',
  };
  const identity = await mobile('auth/magic/verify', 200, json(magicInput));
  const magicTokens = z.object({ accessToken: z.string() }).parse(identity.data);
  await mobile('auth/magic/verify', 401, json(magicInput));
  await mobile('auth/logout', 200, json({}, magicTokens.accessToken));
  const fixture = fixtureSchema.parse(
    await (await fetch(`${base}/_smoke/mobile-session`, { method: 'POST' })).json(),
  );
  const bearer = { headers: { Authorization: `Bearer ${fixture.accessToken}` } };
  assert.equal((await mobile('auth/sessions', 401)).error?.code, 'E_UNAUTHORIZED');
  assert.equal(
    (await mobile('auth/sessions', 401, { headers: { cookie: 'authjs.session-token=irrelevant' } }))
      .error?.code,
    'E_UNAUTHORIZED',
  );
  const sessions = await mobile('auth/sessions', 200, bearer);
  const listed = z
    .object({
      sessions: z.array(z.object({ id: z.string(), current: z.boolean(), platform: z.string() })),
    })
    .parse(sessions.data);
  assert.deepEqual(
    listed.sessions.map(({ id, current, platform }) => ({ id, current, platform })),
    [{ id: fixture.sessionId, current: true, platform: 'ios' }],
  );
  for (const resource of ['profiles', 'readings', 'journal', 'settings']) {
    const value = await mobile(`sync/${resource}?since=0&limit=1`, 200, bearer);
    const page = z.object({ items: z.array(z.unknown()), cursor: z.string() }).parse(value.data);
    if (resource === 'settings') {
      const settings = z
        .object({ id: z.string(), settings: z.object({ locale: z.string() }) })
        .parse(page.items[0]);
      assert.equal(settings.id, fixture.userId);
      await mobile(
        'sync/settings',
        200,
        json(
          {
            items: [
              {
                id: fixture.userId,
                updatedAt: new Date(Date.now() + 1000).toISOString(),
                deleted: false,
                settings: { locale: 'en' },
              },
            ],
          },
          fixture.accessToken,
          'PUT',
        ),
      );
      const updated = z
        .object({ items: z.array(z.object({ settings: z.object({ locale: z.string() }) })) })
        .parse(
          (await mobile(`sync/settings?since=${encodeURIComponent(page.cursor)}`, 200, bearer))
            .data,
        );
      assert.equal(updated.items[0]?.settings.locale, 'en');
    }
  }
  assert.equal((await mobile('knowledge/manifest', 404, bearer)).error?.code, 'E_NOT_FOUND');
  await mobile('knowledge/bundle/1.0.0', 404, bearer);
  const callback = json(
    { event: { id: `integration-${crypto.randomUUID()}`, type: 'TEST' } },
    'isolated-revenuecat-smoke',
  );
  // Disabled provider traffic stops at the main Worker before the compute service.
  for (const options of [json({ event: { id: 'unsigned', type: 'TEST' } }), callback]) {
    const disabled = await fetch(`${base}/api/v1/mobile/webhooks/revenuecat`, options);
    assert.equal(disabled.status, 404);
    checks.push('POST webhooks/revenuecat: 404 (membership disabled)');
  }
  const entitlement = await mobile('entitlements/sync', 200, { ...bearer, method: 'POST' });
  assert.deepEqual(entitlement.data, {
    userId: fixture.userId,
    plan: 'free',
    lifetime: false,
    revenuecatProUntil: null,
  });
  await fetch(`${base}/_smoke/circuit`, json({ state: 'open' }));
  try {
    const maintenance = await mobile('sync/profiles', 503, bearer);
    assert.equal(maintenance.error?.code, 'E_INTERNAL');
    await mobile('auth/sessions', 200, bearer);
    await mobile(
      'auth/challenge',
      200,
      json({
        provider: 'apple',
        deviceName: 'iOS smoke',
        platform: 'ios',
        codeChallenge: 'A'.repeat(43),
      }),
    );
    assert.equal((await fetch(`${base}/api/v1/mobile/webhooks/revenuecat`, callback)).status, 404);
  } finally {
    await fetch(`${base}/_smoke/circuit`, json({ state: 'closed' }));
  }
  const rotated = z
    .object({ accessToken: z.string(), refreshToken: z.string() })
    .parse((await mobile('auth/refresh', 200, json({ refreshToken: fixture.refreshToken }))).data);
  assert.notEqual(rotated.accessToken, fixture.accessToken);
  await mobile('auth/sessions', 401, bearer);
  await mobile('auth/refresh', 401, json({ refreshToken: fixture.refreshToken }));
  await mobile('auth/logout', 200, json({}, rotated.accessToken));
  await mobile('auth/sessions', 401, {
    headers: { Authorization: `Bearer ${rotated.accessToken}` },
  });
  console.log(
    `Mobile main → compute smoke passed: ${checks.length} assertions; no public cache, rotation, sync, maintenance, disabled membership callbacks.`,
  );
  return checks;
}
