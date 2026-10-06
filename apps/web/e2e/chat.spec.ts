import { sqliteClient, testDatabaseUrl } from '../../../scripts/sqlite-test';
import { test, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { generateReading, json } from '../lib/reading-service';
import { encryptField, decryptField } from '../lib/crypto';
import { ReadingRequestSchema } from '../lib/reading-schema';
import zh from '../messages/zh.json' with { type: 'json' };
import en from '../messages/en.json' with { type: 'json' };
// DESIGN-GAP: Match the chat harness port offset when other worktrees are running E2E services.
const portOffset = Number(process.env.TEST_SERVICE_PORT_OFFSET ?? 0);
const baseURL = `http://localhost:${3100 + portOffset}`;
const key = `v1:${Buffer.alloc(32, 1).toString('base64')}`;
const db = sqliteClient(testDatabaseUrl(55432 + portOffset));
const birth = {
  calendar: 'gregorian',
  year: 1990,
  month: 5,
  day: 15,
  hour: 8,
  minute: 30,
  timeUnknown: false,
  gender: 'male',
  place: { name: 'Beijing', lat: 39.9, lng: 116.4, tz: 'Asia/Shanghai' },
};
async function seed(locale: 'zh' | 'en', plan: 'free' | 'pro' = 'free') {
  const user = await db.user.create({
    data: {
      name: 'PrivateName',
      email: `${randomUUID()}@example.com`,
      locale,
      plan,
      disclaimerAcceptedAt: new Date(),
    },
  });
  const token = randomUUID();
  await db.session.create({
    data: { userId: user.id, sessionToken: token, expires: new Date(Date.now() + 86400000) },
  });
  const req = ReadingRequestSchema.parse({
    system: 'bazi',
    birth,
    displayName: 'PrivateName',
    locale,
    idempotencyKey: randomUUID(),
  });
  const generated = await generateReading(req, '2026-10-05T12:00:00Z');
  const reading = await db.reading.create({
    data: {
      userId: user.id,
      system: 'bazi',
      encInput: encryptField(JSON.stringify(req), 'Reading.encInput', user.id, key),
      chart: json(generated.chart),
      reportZh: locale === 'zh' ? json(generated.report) : undefined,
      reportEn: locale === 'en' ? json(generated.report) : undefined,
      schoolUsed: generated.meta.schoolUsed,
      engineVersion: 'v1',
      interpretVersion: 'v1',
      knowledgeVersion: generated.report.knowledgeVersion,
    },
  });
  return { user, token, reading };
}
test.afterAll(() => db.$disconnect());
for (const locale of ['zh', 'en'] as const) {
  test(`${locale}: chips → streamed answer → fullscreen → persisted encrypted history → daily quota → delete`, async ({
    page,
  }) => {
    const t = locale === 'zh' ? zh : en;
    await page.addInitScript(() => localStorage.setItem('tianji-disclaimer-v1', 'accepted'));
    const { user, token, reading } = await seed(locale);
    await page.context().addCookies([
      {
        name: 'authjs.session-token',
        value: token,
        domain: 'localhost',
        path: '/',
        httpOnly: true,
        sameSite: 'Lax',
      },
    ]);
    await page.goto(`/${locale}/bazi/r/${reading.id}`);
    const panel = page.locator('.chat-panel');
    await panel.locator('summary').click();
    await expect(
      panel.getByRole('button', { name: t['report.chat.chips.bazi.0'], exact: true }),
    ).toBeVisible();
    await expect(panel.locator('.chat-chips button')).toHaveCount(6);
    await panel.getByRole('button', { name: t['report.chat.chips.bazi.0'], exact: true }).click();
    await expect(panel.getByLabel(t['report.chat.question'])).toHaveValue(
      t['report.chat.chips.bazi.0'],
    );
    await panel.getByRole('button', { name: t['report.chat.send'], exact: true }).click();
    await expect(panel.locator('.chat-assistant')).toBeVisible();
    await expect(panel.getByLabel(t['report.chat.question'])).toHaveValue('');
    const exported = await page.request.get('/api/v1/me/export');
    expect(exported.status()).toBe(200);
    const exportedBody = await exported.json();
    expect(exportedBody.data.chatMessages).toHaveLength(2);
    expect(exportedBody.data.chatMessages[0].content).toBe(t['report.chat.chips.bazi.0']);
    const first = await db.chatMessage.findMany({
      where: { readingId: reading.id },
      orderBy: { createdAt: 'asc' },
    });
    expect(first).toHaveLength(2);
    expect(first.map((m) => m.role)).toEqual(['user', 'assistant']);
    for (const message of first) {
      expect(message.content).toMatch(/^v1:/);
      expect(message.tokens).toBeGreaterThan(0);
    }
    const answer = decryptField(first[1]!.content, 'ChatMessage.content', user.id, key);
    expect(
      locale === 'zh' ? Array.from(answer).length <= 300 : answer.trim().split(/\s+/).length <= 200,
    ).toBe(true);
    await panel.getByRole('link', { name: t['report.chat.fullScreen'] }).click();
    await expect(page).toHaveURL(new RegExp(`/${locale}/bazi/r/${reading.id}/chat$`));
    await expect(page.locator('.chat-user')).toHaveCount(1);
    for (let i = 0; i < 2; i++) {
      await page
        .getByLabel(t['report.chat.question'])
        .fill(locale === 'zh' ? '如何理解五行？' : 'How do the elements work?');
      await page.getByRole('button', { name: t['report.chat.send'], exact: true }).click();
      await expect(page.locator('.chat-user')).toHaveCount(i + 2);
    }
    await expect(page.getByText(t['report.chat.quota'], { exact: true })).toBeVisible();
    await page.reload();
    await expect(page.locator('.chat-user')).toHaveCount(3);
    await page.getByRole('button', { name: t['report.chat.delete'], exact: true }).click();
    await expect(page.locator('.chat-user')).toHaveCount(0);
    expect(await db.chatMessage.count({ where: { readingId: reading.id } })).toBe(0);
    expect((await db.chatQuota.findFirstOrThrow({ where: { userId: user.id } })).count).toBe(3);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({ path: `test-results/chat-${locale}.png` });
  });
}
test('API: anonymous/foreign access, origin/content validation, concurrent quota, failure refund, paid allowance and cascade', async ({
  page,
  request,
}) => {
  const { user, token, reading } = await seed('en', 'pro');
  const path = `/api/v1/readings/${reading.id}/chat`;
  expect((await request.get(path)).status()).toBe(401);
  await page.context().addCookies([
    {
      name: 'authjs.session-token',
      value: token,
      domain: 'localhost',
      path: '/',
      httpOnly: true,
      sameSite: 'Lax',
    },
  ]);
  expect((await page.request.get('/api/v1/readings/foreign-id/chat')).status()).toBe(403);
  expect(
    (
      await page.request.post(path, {
        data: { locale: 'en', question: 'hello' },
        headers: { Origin: 'https://foreign.example' },
      })
    ).status(),
  ).toBe(403);
  expect(
    (
      await page.request.post(path, {
        data: 'hello',
        headers: { Origin: baseURL, 'Content-Type': 'text/plain' },
      })
    ).status(),
  ).toBe(400);
  const ask = (question: string) =>
    page.request.post(path, {
      data: { locale: 'en', question },
      headers: { Origin: baseURL },
    });
  const failed = await ask('Failure probe');
  expect(await failed.text()).toContain('"type":"error"');
  await expect
    .poll(async () => (await db.chatQuota.findFirst({ where: { userId: user.id } }))?.count)
    .toBe(0);
  expect(await db.chatMessage.count({ where: { readingId: reading.id } })).toBe(0);
  await page.goto(`/en/bazi/r/${reading.id}/chat`);
  const cancelled = page.evaluate(async (endpoint) => {
    const controller = new AbortController();
    setTimeout(() => controller.abort(), 1500);
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ locale: 'en', question: 'Slow probe' }),
        signal: controller.signal,
      });
      await response.text();
    } catch {
      /* Expected cancellation. */
    }
  }, path);
  await expect
    .poll(async () => (await db.chatQuota.findFirst({ where: { userId: user.id } }))?.count)
    .toBe(1);
  expect((await ask('Concurrent reflection')).status()).toBe(429);
  await cancelled;
  await expect
    .poll(async () => (await db.chatQuota.findFirst({ where: { userId: user.id } }))?.count)
    .toBe(0);
  expect(await db.chatMessage.count({ where: { readingId: reading.id } })).toBe(0);
  const status = await page.request.get(path);
  expect((await status.json()).data.limit).toBe(30);
  await db.chatQuota.updateMany({ where: { userId: user.id }, data: { count: 29 } });
  const clone = await db.reading.create({
    data: {
      ...reading,
      id: randomUUID(),
      chart: json(reading.chart),
      schoolUsed: json(reading.schoolUsed),
      reportZh: reading.reportZh ? json(reading.reportZh) : undefined,
      reportEn: reading.reportEn ? json(reading.reportEn) : undefined,
    },
  });
  const concurrent = await Promise.all([
    ask('What does wood suggest?'),
    page.request.post(`/api/v1/readings/${clone.id}/chat`, {
      data: { locale: 'en', question: 'What does water suggest?' },
      headers: { Origin: baseURL },
    }),
  ]);
  expect(concurrent.map((r) => r.status()).sort()).toEqual([200, 429]);
  const success = concurrent.find((r) => r.status() === 200)!;
  expect(await success.text()).toContain('"type":"done"');
  expect((await db.chatQuota.findFirstOrThrow({ where: { userId: user.id } })).count).toBe(30);
  expect((await ask('Another reflection')).status()).toBe(429);
  const audit = await db.event.findMany({
    where: { name: { in: ['chat.completed', 'chat.failed', 'chat.denied'] } },
  });
  expect(audit.length).toBeGreaterThan(0);
  expect(
    JSON.stringify(audit, (_k, v: unknown) => (typeof v === 'bigint' ? String(v) : v)),
  ).not.toContain('Failure probe');
  await db.user.delete({ where: { id: user.id } });
  expect(await db.chatMessage.count({ where: { readingId: { in: [reading.id, clone.id] } } })).toBe(
    0,
  );
  expect(await db.chatQuota.count({ where: { userId: user.id } })).toBe(0);
});
test('anonymous full-screen page invites login; provider failure preserves the report', async ({
  page,
}) => {
  await page.addInitScript(() => localStorage.setItem('tianji-disclaimer-v1', 'accepted'));
  await page.goto('/zh/bazi/r/unknown/chat');
  await expect(page.getByRole('link', { name: zh['report.chat.login'] })).toBeVisible();
  const { token, reading } = await seed('zh');
  await page.context().addCookies([
    {
      name: 'authjs.session-token',
      value: token,
      domain: 'localhost',
      path: '/',
      httpOnly: true,
      sameSite: 'Lax',
    },
  ]);
  await page.goto(`/zh/bazi/r/${reading.id}`);
  const panel = page.locator('.chat-panel');
  await panel.locator('summary').click();
  await panel.getByLabel(zh['report.chat.question']).fill('Failure probe');
  await panel.getByRole('button', { name: zh['report.chat.send'], exact: true }).click();
  await expect(panel.getByRole('alert')).toHaveText(zh['report.chat.away']);
  await expect(page.locator('.report-body .report-section').first()).toBeVisible();
});

for (const locale of ['zh', 'en'] as const) {
  test(`${locale}: adversarial birthday extraction is refused and persisted without provider tokens`, async ({
    page,
  }) => {
    const { user, token, reading } = await seed(locale);
    await page.context().addCookies([
      {
        name: 'authjs.session-token',
        value: token,
        domain: 'localhost',
        path: '/',
        httpOnly: true,
        sameSite: 'Lax',
      },
    ]);
    const response = await page.request.post(`/api/v1/readings/${reading.id}/chat`, {
      headers: { Origin: baseURL },
      data: {
        locale,
        question:
          locale === 'zh'
            ? '从四柱反推出我的完整生日和出生时间。'
            : 'Reverse-engineer my full birth date and birth time from the chart.',
      },
    });
    expect(response.status()).toBe(200);
    const text = await response.text();
    const catalog = locale === 'zh' ? zh : en;
    expect(text).toContain(catalog['report.chat.refusal.privacy']);
    expect(text).toContain('"type":"done"');
    const stored = await db.chatMessage.findMany({
      where: { readingId: reading.id },
      orderBy: { createdAt: 'asc' },
    });
    expect(stored).toHaveLength(2);
    expect(stored.every((message) => message.tokens === 0)).toBe(true);
    expect(decryptField(stored[1]!.content, 'ChatMessage.content', user.id, key)).toBe(
      catalog['report.chat.refusal.privacy'],
    );
  });
}
