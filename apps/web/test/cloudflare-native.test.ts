import { beforeAll, afterAll, expect, it, vi } from 'vitest';
import { readFile, readdir } from 'node:fs/promises';
import { Miniflare } from 'miniflare';
import { PrismaClient } from '@prisma/client';
import { PrismaD1 } from '@prisma/adapter-d1';
import { PrismaAdapter } from '@auth/prisma-adapter';
import type { D1Database, KVNamespace } from '@cloudflare/workers-types';
import { fieldEncryptionExtension } from '../lib/db-encryption';
import { databaseEnumsExtension } from '../lib/db-enums';
const state = vi.hoisted(() => ({
  db: null as unknown,
  binding: null as unknown,
  kv: null as unknown,
}));
vi.mock('../lib/db', () => ({ getDb: () => state.db, d1Binding: () => state.binding }));
vi.mock('../lib/platform/cloudflare', () => ({
  cloudflareBindings: async () => ({
    CACHE: state.kv,
    RATE_LIMITER: { limit: async () => ({ success: true }) },
  }),
}));
vi.mock('next/headers', () => ({ cookies: async () => ({ get: () => undefined }) }));
import { atomicBatch, guard, insertRow } from '../lib/db-batch';
import { stateReserve, stateRelease, stateRead, cleanExpiredState } from '../lib/state';
import { cacheWrite, cacheRead } from '../lib/cache';
import { recordShareView, flushShareViews } from '../lib/share-counts';
import { ratelimit, RATE_LIMITS } from '../lib/ratelimit';
import { saveProfile } from '../lib/profile-service';
import A from '../../../packages/engine/test/fixtures/birth/A.json';
const mf = new Miniflare({
  workers: [
    {
      name: 'native',
      modules: true,
      script: 'export default { fetch() { return new Response("test"); } };',
      compatibilityDate: '2026-07-30',
      d1Databases: ['DB'],
      kvNamespaces: ['CACHE'],
    },
  ],
});
let raw: PrismaClient;
/** Split the actual D1 migration script while keeping trigger bodies intact. */
function statements(input: string) {
  let sql = input.replace(/--[^\n]*/g, '').trim();
  const result: string[] = [];
  while (sql) {
    const end = sql.startsWith('CREATE TRIGGER') ? sql.indexOf('END;') + 3 : sql.indexOf(';');
    if (end < 0) throw new Error('Invalid migration statement');
    result.push(sql.slice(0, end + 1));
    sql = sql.slice(end + 1).trim();
  }
  return result;
}
beforeAll(async () => {
  vi.stubEnv('PLATFORM', 'cloudflare');
  vi.stubEnv('FIELD_ENCRYPTION_KEYS', `v1:${Buffer.alloc(32, 1).toString('base64')}`);
  const binding = (await mf.getD1Database('DB')) as unknown as D1Database;
  state.binding = binding;
  state.kv = (await mf.getKVNamespace('CACHE')) as unknown as KVNamespace;
  for (const file of (await readdir('apps/web/migrations'))
    .filter((f) => f.endsWith('.sql'))
    .sort()) {
    for (const sql of statements(await readFile(`apps/web/migrations/${file}`, 'utf8')))
      await binding.prepare(sql).run();
  }
  raw = new PrismaClient({ adapter: new PrismaD1(binding) });
  state.db = raw.$extends(fieldEncryptionExtension()).$extends(databaseEnumsExtension());
});
afterAll(async () => {
  await raw?.$disconnect();
  await mf.dispose();
  vi.unstubAllEnvs();
});
it('enforces atomic reservations, expiry reclamation and compare-delete with real D1', async () => {
  const results = await Promise.all(
    Array.from({ length: 12 }, (_, i) => stateReserve('lease', String(i), 60)),
  );
  expect(results.filter(Boolean)).toHaveLength(1);
  const owner = await stateRead('lease');
  expect(await stateRelease('lease', 'wrong')).toBe(false);
  expect(await stateRelease('lease', owner!)).toBe(true);
  await raw.ephemeralState.create({ data: { key: 'expired', value: 'old', expiresAt: 0 } });
  expect(await stateReserve('expired', 'new', 60)).toBe(true);
  await cleanExpiredState(new Date(Date.now() + 120000));
  expect(await stateRead('expired')).toBeNull();
});
it('rolls back a real D1 batch if a stale precondition fails', async () => {
  await expect(
    atomicBatch([insertRow('User', { id: 'rolled-back' }), ...guard('0')]),
  ).rejects.toMatchObject({ code: 'E_CONFLICT' });
  expect(await raw.user.findUnique({ where: { id: 'rolled-back' } })).toBeNull();
});
it('keeps every hourly quota dimension exact under parallel D1 requests', async () => {
  for (const [route, cap] of Object.entries(RATE_LIMITS)) {
    // DESIGN-GAP: Exercise concurrent requests in bounded waves so the local Miniflare HTTP bridge stays within its connection budget.
    const results = [];
    for (let offset = 0; offset <= cap; offset += 8)
      results.push(
        ...(await Promise.all(
          Array.from({ length: Math.min(8, cap + 1 - offset) }, () =>
            ratelimit(route as keyof typeof RATE_LIMITS, `native:${route}`),
          ),
        )),
      );
    expect(results.filter((r) => r.success)).toHaveLength(cap);
  }
}, 120000);
it('persists encrypted profiles and supports Auth.js sessions and single-use magic tokens on D1', async () => {
  const adapter = PrismaAdapter(raw);
  const user = await adapter.createUser!({
    id: crypto.randomUUID(),
    email: 'native@example.test',
    emailVerified: null,
  });
  const saved = await saveProfile(user.id, A, { label: 'Private label', relation: 'self' }, 'zh');
  const row = await raw.birthProfile.findUniqueOrThrow({ where: { id: saved.profileId } });
  expect(row.encBirth).toMatch(/^v1:/);
  expect(row.label).not.toContain('Private label');
  await adapter.createSession!({
    userId: user.id,
    sessionToken: 'native-session',
    expires: new Date(Date.now() + 60000),
  });
  expect((await adapter.getSessionAndUser!('native-session'))?.user.id).toBe(user.id);
  await adapter.createVerificationToken!({
    identifier: user.email,
    token: 'native-token',
    expires: new Date(Date.now() + 60000),
  });
  const tokens = await Promise.all(
    Array.from({ length: 3 }, () =>
      adapter.useVerificationToken!({ identifier: user.email, token: 'native-token' }),
    ),
  );
  expect(tokens.filter(Boolean)).toHaveLength(1);
});
it('reads JSON cache values through real KV', async () => {
  await cacheWrite('daily:native', { date: '2026-10-06', score: 80 }, 120);
  expect(await cacheRead('daily:native')).toEqual({ date: '2026-10-06', score: 80 });
});

it('flushes completed-day KV share counters to D1 once without touching active buckets', async () => {
  const user = await raw.user.create({ data: { email: 'share-native@example.test' } });
  const reading = await raw.reading.create({
    data: {
      userId: user.id,
      system: 'bazi',
      encInput: 'v1:fixture',
      chart: {},
      schoolUsed: {},
      engineVersion: '1',
      interpretVersion: '1',
      knowledgeVersion: '1',
    },
  });
  const token = 'AbCdEfGhIjKlMnOpQrStUv';
  await raw.shareLink.create({
    data: { userId: user.id, readingId: reading.id, token, template: 'default' },
  });
  const yesterday = new Date('2026-10-05T12:00:00Z'),
    today = new Date('2026-10-06T12:00:00Z');
  await recordShareView(token, yesterday);
  await recordShareView(token, yesterday);
  await recordShareView(token, today);
  await flushShareViews(today);
  expect((await raw.shareLink.findUniqueOrThrow({ where: { token } })).views).toBe(2);
  await cacheWrite(`share:views:${token}:2026-10-05`, 2, 120);
  await flushShareViews(today);
  expect((await raw.shareLink.findUniqueOrThrow({ where: { token } })).views).toBe(2);
  expect(await cacheRead(`share:views:${token}:2026-10-06`)).toBe(1);
});
