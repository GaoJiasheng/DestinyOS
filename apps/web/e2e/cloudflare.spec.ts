import { mkdir, writeFile } from 'node:fs/promises';
import { p75 } from '../../../scripts/perf-ttfb-support';
import { test, expect } from '@playwright/test';
import zh from '../messages/zh.json' with { type: 'json' };
import en from '../messages/en.json' with { type: 'json' };
import glossaryVersions from '../i18n/glossary-versions.json' with { type: 'json' };
for (const locale of ['zh', 'en'] as const) {
  const copy = locale === 'zh' ? zh : en;
  test(`${locale}: Workers homepage → anonymous bazi report → daily fortune`, async ({
    page,
    request,
  }) => {
    await page.addInitScript(() => localStorage.setItem('tianji-disclaimer-v1', 'accepted'));
    await page.goto(`/${locale}`);
    await expect(page.locator('h1')).toBeVisible();
    const providers = await request.get('/api/auth/providers');
    expect(providers.status()).toBe(200);
    expect(await providers.json()).toHaveProperty('google');
    await page.goto(`/${locale}/bazi/new`);
    await page.getByLabel(copy['form.birth.year'], { exact: true }).fill('1990');
    await page.getByLabel(copy['form.birth.month'], { exact: true }).fill('5');
    await page.getByLabel(copy['form.birth.day'], { exact: true }).fill('15');
    await page.getByLabel(copy['form.birth.precise'], { exact: true }).check();
    await page.getByLabel(copy['form.birth.time'], { exact: true }).fill('08:30');
    await page.getByRole('button', { name: copy['form.birth.next'], exact: true }).click();
    await page.getByLabel(copy['form.birth.city'], { exact: true }).fill('Beijing');
    await page.getByRole('option').filter({ hasText: 'Asia/Shanghai' }).first().click();
    await page.getByLabel(copy['form.birth.gender'], { exact: true }).selectOption('male');
    await page
      .getByRole('button', { name: locale === 'zh' ? '排盘' : 'Create reading', exact: true })
      .click();
    await expect(page).toHaveURL(new RegExp(`/${locale}/bazi/r/local/`), { timeout: 90000 });
    await expect(
      page.getByRole('heading', {
        name: locale === 'zh' ? '命盘概览' : 'Your Chart at a Glance',
        exact: true,
      }),
    ).toBeVisible();
    await page.goto(`/${locale}/today`);
    await expect(page.locator('[data-daily-block]')).toHaveCount(13);
    const today = await page.locator('header time').getAttribute('datetime');
    await page.getByRole('button', { name: copy['daily.tomorrow'], exact: true }).click();
    await expect(page.locator('header time')).not.toHaveAttribute('datetime', today!);
    await expect(page.locator('[data-daily-block="10"] li')).toHaveCount(6);
    await page.screenshot({ path: `test-results/cloudflare-${locale}-today.png` });
    expect(
      (
        await request.post('/api/v1/stripe/webhook', {
          headers: { 'stripe-signature': 'invalid' },
          data: '{ "test": true }',
        })
      ).status(),
    ).toBe(404);
    expect((await request.get('/api/v1/cron/daily-maintenance')).status()).toBe(401);
  });
}

// The local-only test entry returns a mock session; the UI and persistence use the actual deployed application modules.
test('mock login → birth form → encrypted D1 reading, KV daily hit, 429 and exports', async ({
  page,
  request,
}) => {
  const session = (await (await request.post('/_smoke/login')).json()) as {
    userId: string;
    token: string;
  };
  await page.context().addCookies([
    {
      name: '__Secure-authjs.session-token',
      value: session.token,
      domain: 'localhost',
      path: '/',
      httpOnly: true,
      secure: true,
      sameSite: 'Lax',
    },
  ]);
  await page.addInitScript(() => localStorage.setItem('tianji-disclaimer-v1', 'accepted'));
  // The documented profile editor explicitly saves the birth used by daily fortunes.
  await page.goto('/zh/me/birth');
  await page.getByLabel(zh['form.birth.year'], { exact: true }).fill('1990');
  await page.getByLabel(zh['form.birth.month'], { exact: true }).fill('5');
  await page.getByLabel(zh['form.birth.day'], { exact: true }).fill('15');
  await page.getByLabel(zh['form.birth.precise'], { exact: true }).check();
  await page.getByLabel(zh['form.birth.time'], { exact: true }).fill('08:30');
  await page.getByRole('button', { name: zh['form.birth.next'], exact: true }).click();
  await page.getByLabel(zh['form.birth.city'], { exact: true }).fill('Beijing');
  await page.getByRole('option').filter({ hasText: 'Asia/Shanghai' }).first().click();
  await page.getByLabel(zh['form.birth.gender'], { exact: true }).selectOption('male');
  await page.getByRole('button', { name: zh['form.birth.save'], exact: true }).click();
  await expect(page).toHaveURL(/\/zh\/me$/);
  await page.goto('/zh/bazi/new');
  await page.getByLabel(zh['form.birth.year'], { exact: true }).fill('1990');
  await page.getByLabel(zh['form.birth.month'], { exact: true }).fill('5');
  await page.getByLabel(zh['form.birth.day'], { exact: true }).fill('15');
  await page.getByLabel(zh['form.birth.precise'], { exact: true }).check();
  await page.getByLabel(zh['form.birth.time'], { exact: true }).fill('08:30');
  await page.getByRole('button', { name: zh['form.birth.next'], exact: true }).click();
  await page.getByLabel(zh['form.birth.city'], { exact: true }).fill('Beijing');
  await page.getByRole('option').filter({ hasText: 'Asia/Shanghai' }).first().click();
  await page.getByLabel(zh['form.birth.gender'], { exact: true }).selectOption('male');
  await page.getByRole('button', { name: '排盘', exact: true }).click();
  await expect(page).toHaveURL(/\/zh\/bazi\/r\/(?!local\/)[^/]+$/, { timeout: 90000 });
  const stateUrl = `/_smoke/state?userId=${encodeURIComponent(session.userId)}`;
  const state = (await (await request.get(stateUrl)).json()) as {
    readings: { encInput: string }[];
    profiles: { encBirth: string }[];
    cache: { name: string; expiration?: number }[];
    cacheWrites: Record<string, number>;
  };
  expect(state.readings.length).toBeGreaterThan(0);
  expect(state.profiles.length).toBeGreaterThan(0);
  expect(state.readings.every((r) => r.encInput.startsWith('v1:'))).toBe(true);
  expect(state.profiles.every((p) => p.encBirth.startsWith('v1:'))).toBe(true);
  await page.goto('/zh/today');
  await expect(page.locator('[data-daily-block]')).toHaveCount(13);
  const first = (await (await request.get(stateUrl)).json()) as typeof state;
  expect(first.cache.length).toBeGreaterThan(0);
  expect(Object.values(first.cacheWrites).reduce((sum, writes) => sum + writes, 0)).toBeGreaterThan(
    0,
  );
  await page.reload();
  await expect(page.locator('[data-daily-block]')).toHaveCount(13);
  const second = (await (await request.get(stateUrl)).json()) as typeof state;
  expect(second.cache).toEqual(first.cache);
  expect(second.cacheWrites).toEqual(first.cacheWrites);
  const exported = await page.request.get('/api/v1/me/export');
  expect(exported.status()).toBe(200);
  expect((await exported.json()).data.readings.length).toBeGreaterThan(0);
  const pdf = await request.get('/_smoke/export');
  expect(pdf.headers()['x-renderer']).toBe('local-mock');
  expect((await pdf.body()).toString()).toContain('%PDF');
  let status = 0;
  for (let i = 0; i < 32; i++)
    status = (await request.get(`/api/v1/og/share/${'A'.repeat(22)}`)).status();
  expect(status).toBe(429);
});

// DESIGN-GAP: Exercise the retained OG WASM/font pipeline and Workers timezone data after removing their Node adapters.
test('slim Worker retains asset-backed timezone lookups and bilingual OG rendering', async ({
  request,
}) => {
  for (const [lat, lng, tz] of [
    [39.9, 116.4, 'Asia/Shanghai'],
    [1.3521, 103.8198, 'Asia/Singapore'],
    [40.7128, -74.006, 'America/New_York'],
  ] as const) {
    const response = await request.get(`/api/v1/geo/tz?lat=${lat}&lng=${lng}`);
    expect(response.status()).toBe(200);
    expect(await response.json()).toEqual({ ok: true, data: { tz } });
  }
  for (const locale of ['zh', 'en', 'zh-TW'] as const) {
    const image = await request.get(`/api/og/public?locale=${locale}&path=/learn`);
    expect(image.status()).toBe(200);
    expect(image.headers()['content-type']).toContain('image/png');
    const bytes = await image.body();
    expect([...bytes.subarray(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
    expect(bytes.readUInt32BE(16)).toBe(1200);
    expect(bytes.readUInt32BE(20)).toBe(630);
  }
  const keys: unknown = await (await request.get('/_smoke/glossary-cache')).json();
  expect(keys).toEqual(
    expect.arrayContaining(
      (['zh', 'en', 'zh-TW'] as const).map(
        (locale) => `glossary:${glossaryVersions[locale]}:${locale}`,
      ),
    ),
  );
});

// Real KV and workerd gate, with no production configuration or Analytics traffic.
test('cost circuit blocks pages and expensive APIs; Cron stays reachable and manual restore works', async ({
  request,
  page,
}) => {
  const admin = (await (await request.post('/_smoke/login?admin=1')).json()) as { token: string };
  await page.context().addCookies([
    {
      name: '__Secure-authjs.session-token',
      value: admin.token,
      domain: 'localhost',
      path: '/',
      secure: true,
      httpOnly: true,
      sameSite: 'Lax',
    },
  ]);
  await request.post('/_smoke/circuit', { data: { state: 'open' } });
  try {
    for (const path of [
      '/zh/pricing',
      '/zh-TW/me/billing',
      '/en/today',
      '/api/export',
      '/api/v1/readings/test/chat',
      '/api/v1/og/daily',
      '/api/v1/og/share/test',
    ]) {
      const response = await request.get(path);
      expect(response.status()).toBe(503);
      expect(response.headers()['cache-control']).toBe('no-store');
      expect(await response.text()).not.toContain('<script');
    }
    const cron = await request.get('/api/v1/cron/cost-circuit', {
      headers: { Authorization: 'Bearer isolated-cron' },
    });
    expect(cron.status()).toBe(200);
    expect(await cron.json()).toMatchObject({ data: { result: 'skipped' } });
    await page.goto('/admin/config');
    await expect(
      page.getByRole('combobox', { name: zh['admin.config.circuit.mode'], exact: true }),
    ).toBeVisible();
    await page
      .getByRole('combobox', { name: zh['admin.config.circuit.mode'], exact: true })
      .selectOption('closed');
    await page.getByRole('button', { name: zh['admin.config.save'], exact: true }).click();
    await expect(page.locator('p[role="status"]')).toHaveText(zh['admin.saved']);
    expect((await request.get('/en/pricing')).status()).toBe(200);
    await page
      .getByRole('combobox', { name: zh['admin.config.circuit.mode'], exact: true })
      .selectOption('auto');
    await page.getByRole('button', { name: zh['admin.config.save'], exact: true }).click();
    await expect(page.locator('p[role="status"]')).toHaveText(zh['admin.saved']);
    expect((await request.get('/en/pricing')).status()).toBe(503);
    expect((await request.post('/api/v1/stripe/webhook', { data: {} })).status()).toBe(404);
  } finally {
    await request.post('/_smoke/circuit', { data: { state: 'closed' } });
  }
  expect((await request.get('/en/pricing')).status()).toBe(200);
});

// DESIGN-GAP: Exercise real workerd Cache API and client navigation, rather than accepting fast SSR as an edge hit.
test('public HTML cache, lightweight health, RSC isolation and deferred qimen remain functional', async ({
  page,
  request,
}) => {
  await request.post('/_smoke/circuit', { data: { state: 'closed' } });
  for (const path of [
    '/zh',
    '/en',
    '/zh/tarot',
    '/zh/qimen',
    '/zh/bazi',
    '/zh/learn',
    '/zh/privacy',
  ]) {
    const first = await request.get(path);
    expect(first.status()).toBe(200);
    await first.body();
    await expect
      .poll(async () => (await request.get(path)).headers()['x-destiny-cache'])
      .toBe('HIT');
    const hit = await request.get(path);
    expect(hit.headers()['cache-control']).toContain('s-maxage=3600');
    expect(hit.headers()['set-cookie'] ?? '').not.toContain('session-token');
    expect(hit.headers()['server-timing']).not.toContain('open-next-init');
    if (path === '/zh' || path === '/en')
      expect((await hit.body()).length).toBeLessThanOrEqual(120000);
    if (path === '/zh/bazi' || path === '/zh/qimen' || path === '/zh/tarot') {
      const system = path.split('/').at(-1);
      expect(await hit.text()).toContain(`data-art="systems/${system}-banner"`);
    }
  }
  const rsc = await request.get('/zh/tarot?_rsc=perf', { headers: { RSC: '1' } });
  expect(rsc.headers()['content-type']).toContain('text/x-component');
  expect(rsc.headers()['cache-control']).toContain('s-maxage=3600');
  for (const prefetch of [false, true]) {
    await expect
      .poll(
        async () =>
          (
            await request.get('/zh/tarot?_rsc=another-opaque-value', {
              headers: { RSC: '1', ...(prefetch ? { 'Next-Router-Prefetch': '1' } : {}) },
            })
          ).headers()['x-destiny-cache'],
      )
      .toBe('HIT');
  }
  const loggedFlight = await request.get('/zh/learn?_rsc=private', {
    headers: { RSC: '1', Cookie: 'authjs.session-token=private-test' },
  });
  expect(loggedFlight.headers()['x-destiny-cache']).toBeUndefined();
  expect(loggedFlight.headers()['cache-control']).toContain('private');
  expect((await request.get('/zh?perf=1')).headers()['x-destiny-cache']).toBeUndefined();
  const health = await request.get('/api/v1/health');
  expect(await health.json()).toMatchObject({ ok: true, db: true, redis: true });
  await expect
    .poll(async () => (await request.get('/api/v1/health')).headers()['x-destiny-health'])
    .toBe('HIT');
  await page.addInitScript(() => localStorage.setItem('tianji-disclaimer-v1', 'accepted'));
  await page.goto('/zh');
  await page.locator('[data-home-system="tarot"]').click();
  await expect(page).toHaveURL(/\/zh\/tarot$/);
  await expect(page.getByLabel(zh['tarot.question'], { exact: true })).toBeVisible();
  await page.goto('/zh/qimen');
  await expect(page.locator('textarea')).toBeVisible();
  await expect(page.locator('[data-art="systems/qimen-banner"] img')).toHaveAttribute(
    'alt',
    zh['art.systems.qimen'],
  );
});

// DESIGN-GAP: Sample completed client navigation separately from server TTFB, after one unmeasured warm-up cycle and 400ms of link intent prefetch.
test('public client navigation completes within the 300ms P75 budget', async ({
  page,
  request,
}) => {
  await request.post('/_smoke/circuit', { data: { state: 'closed' } });
  await page.addInitScript(() => localStorage.setItem('tianji-disclaimer-v1', 'accepted'));
  await page.goto('/zh');
  await expect(page.locator('.navigation-progress')).toHaveAttribute('data-ready', 'true');
  const results: { path: string; samples: number[]; p75Ms: number }[] = [
    '/zh/tarot',
    '/zh/today',
    '/zh/learn',
    '/zh',
  ].map((path) => ({ path, samples: [], p75Ms: 0 }));
  for (let cycle = 0; cycle <= 10; cycle++) {
    for (const result of results) {
      await page.evaluate((path) => {
        const link = [...document.querySelectorAll<HTMLAnchorElement>(`a[href="${path}"]`)].find(
          (node) => node.getClientRects().length > 0,
        );
        if (!link) throw new Error(`Missing navigation link: ${path}`);
        link.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
        link.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
      }, result.path);
      await page.waitForTimeout(400);
      const elapsed = await page.evaluate(async (path) => {
        const link = [...document.querySelectorAll<HTMLAnchorElement>(`a[href="${path}"]`)].find(
          (node) => node.getClientRects().length > 0,
        );
        const previous = [...document.querySelectorAll('main h1')].find(
          (node) => node.getClientRects().length > 0,
        )?.textContent;
        if (!link) throw new Error('Missing navigation link');
        const started = performance.now();
        link.click();
        while (performance.now() - started < 10000) {
          await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
          const title = [...document.querySelectorAll('main h1')].find(
            (node) => node.getClientRects().length > 0,
          )?.textContent;
          if (
            location.pathname === path &&
            title &&
            title !== previous &&
            document.querySelector('.navigation-progress')?.getAttribute('data-active') === 'false'
          )
            return performance.now() - started;
        }
        throw new Error(`Navigation did not finish: ${path}`);
      }, result.path);
      if (cycle > 0) result.samples.push(elapsed);
    }
  }
  for (const result of results) result.p75Ms = p75(result.samples);
  await mkdir('.test-data', { recursive: true });
  await writeFile(
    '.test-data/perf-navigation.json',
    JSON.stringify(
      {
        mode: 'warm, link intent prefetch; click to changed heading and finished navigation',
        results,
      },
      null,
      2,
    ) + '\n',
  );
  for (const result of results) expect(result.p75Ms, result.path).toBeLessThanOrEqual(300);
});
