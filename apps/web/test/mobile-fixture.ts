import { beforeAll, beforeEach, afterAll, vi } from 'vitest';
import { readFile, readdir } from 'node:fs/promises';
import { Miniflare } from 'miniflare';
import { PrismaClient } from '@prisma/client';
import { PrismaD1 } from '@prisma/adapter-d1';
import type { D1Database } from '@cloudflare/workers-types';
import { fieldEncryptionExtension } from '../lib/db-encryption';
import { databaseEnumsExtension } from '../lib/db-enums';
const state = vi.hoisted(() => ({
  db: null as unknown,
  binding: null as unknown,
  bucket: null as unknown,
}));
vi.mock('../lib/db', () => ({ getDb: () => state.db, d1Binding: () => state.binding }));
vi.mock('../lib/platform/cloudflare', () => ({
  cloudflareBindings: async () => ({
    EXPORT_BUCKET: state.bucket,
    RATE_LIMITER: { limit: async () => ({ success: true }) },
  }),
}));
vi.mock('../lib/platform/resources', async () => {
  const { readFile, readdir } = await import('node:fs/promises');
  return {
    resourceText: async (key: string) => readFile(`apps/web/${key}`, 'utf8'),
    resourceBytes: async (key: string) => readFile(`apps/web/${key}`),
    resourceNames: async (key: string) => readdir(`apps/web/${key}`),
  };
});
vi.mock('../lib/auth', () => ({ auth: vi.fn(async () => ({ user: { id: 'web-cookie-user' } })) }));
vi.mock('next/headers', () => ({ cookies: async () => ({ get: () => undefined }) }));
vi.mock('../lib/platform/email', () => ({ sendEmail: vi.fn(async () => undefined) }));
vi.mock('../lib/platform/storage', () => ({
  readExport: vi.fn(async () => null),
  writeExport: vi.fn(async () => undefined),
}));
vi.mock('../lib/llm/reply', () => ({
  streamChatReply: vi.fn(async function* () {
    yield { type: 'delta' as const, text: 'Grounded reply' };
    yield {
      type: 'usage' as const,
      usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 },
    };
  }),
}));
vi.mock('../lib/report-export', async (original) => ({
  ...(await original<typeof import('../lib/report-export')>()),
  renderExport: vi.fn(async () => new Uint8Array([1, 2, 3])),
}));
export const mf = new Miniflare({
  modules: true,
  script: 'export default {fetch(){return new Response("test")}}',
  compatibilityDate: '2026-07-30',
  d1Databases: ['DB'],
  r2Buckets: ['EXPORT_BUCKET'],
});
export let raw: PrismaClient, db: ReturnType<typeof enhanced>;
function enhanced(client: PrismaClient) {
  return client.$extends(fieldEncryptionExtension()).$extends(databaseEnumsExtension());
}
export const stamp = (offset = 1000) => new Date(Date.now() + offset).toISOString();
export function request(path: string, method = 'GET', value?: unknown, token?: string) {
  return new Request(`https://tianji.gavin.pub/api/v1/mobile/${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(value === undefined ? {} : { body: JSON.stringify(value) }),
  });
}
export const metadata = { label: 'Private profile', relation: 'self' };
beforeAll(async () => {
  vi.stubEnv('PLATFORM', 'cloudflare');
  vi.stubEnv('AUTH_SECRET', 'mobile-test-secret');
  vi.stubEnv('FIELD_ENCRYPTION_KEYS', `v1:${Buffer.alloc(32, 1).toString('base64')}`);
  vi.stubEnv('REVENUECAT_SECRET_KEY', '');
  const binding = (await mf.getD1Database('DB')) as unknown as D1Database;
  state.binding = binding;
  state.bucket = await mf.getR2Bucket('EXPORT_BUCKET');
  for (const file of (await readdir('apps/web/migrations'))
    .filter((name) => name.endsWith('.sql'))
    .sort()) {
    let sql = (await readFile(`apps/web/migrations/${file}`, 'utf8'))
      .replace(/--[^\n]*/g, '')
      .trim();
    while (sql) {
      const end = sql.startsWith('CREATE TRIGGER') ? sql.indexOf('END;') + 3 : sql.indexOf(';');
      if (end < 0) throw new Error('Migration parse');
      await binding.prepare(sql.slice(0, end + 1)).run();
      sql = sql.slice(end + 1).trim();
    }
  }
  raw = new PrismaClient({ adapter: new PrismaD1(binding) });
  db = enhanced(raw);
  state.db = db;
});
beforeEach(async () => {
  vi.clearAllMocks();
  await raw.user.deleteMany();
  await raw.ephemeralState.deleteMany();
  await raw.rateLimitHit.deleteMany();
  await raw.user.createMany({
    data: [
      { id: 'owner', email: 'owner@example.test' },
      { id: 'other', email: 'other@example.test' },
    ],
  });
});
afterAll(async () => {
  await raw.$disconnect();
  await mf.dispose();
  vi.unstubAllEnvs();
});
