import { isolatedSqlite } from '../../../scripts/sqlite-test';
import { afterAll, beforeAll, expect, it, vi } from 'vitest';
import type { PrismaClient } from '@prisma/client';
const state = vi.hoisted(() => ({
  db: null as unknown,
  selected: undefined as string | undefined,
}));
vi.mock('../lib/db', () => ({ getDb: () => state.db }));
vi.mock('next/headers', () => ({
  cookies: async () => ({ get: () => (state.selected ? { value: state.selected } : undefined) }),
  headers: async () => new Headers(),
}));
vi.mock('next-intl/server', () => ({
  getLocale: async () => 'zh',
  getTranslations: async () => (key: string) => key,
}));
vi.mock('../lib/auth', () => ({ auth: async () => ({ user: { id: owner.id, plan: 'free' } }) }));
const { listReadingHistory } = await import('../lib/reading-history');
const pg = isolatedSqlite();
let raw: PrismaClient;
const owner = vi.hoisted(() => ({ id: '' }));
beforeAll(async () => {
  raw = pg.client;
  state.db = raw;
  owner.id = (await raw.user.create({ data: {} })).id;
  const profile = (id: string, isDefault: boolean) =>
    raw.birthProfile.create({
      data: {
        id,
        userId: owner.id,
        label: id,
        relation: 'self',
        encBirth: '{}',
        tz: 'UTC',
        birthYear: 1990,
        chartHash: id,
        gender: 'male',
        timeUnknown: false,
        isDefault,
      },
    });
  await profile('p1', true);
  await profile('p2', false);
  const reading = (id: string, profileId: string | null) =>
    raw.reading.create({
      data: {
        id,
        userId: owner.id,
        profileId,
        system: 'bazi',
        encInput: '{}',
        chart: {},
        schoolUsed: {},
        engineVersion: '1',
        interpretVersion: '1',
        knowledgeVersion: '1',
      },
    });
  await reading('mine', 'p1');
  await reading('theirs', 'p2');
  await reading('trial', null);
});
afterAll(async () => {
  await raw?.$disconnect();
  await pg.close();
});
const ids = async (input: unknown) => {
  const result = await listReadingHistory(input);
  if (!result.ok) throw new Error(result.error.code);
  return result.data.items.map((item) => item.id).sort();
};
it('readings without a profile (trials for others) appear in all but in no single profile filter', async () => {
  expect(await ids({ profile: 'all' })).toEqual(['mine', 'theirs', 'trial']);
  expect(await ids({ profile: 'p1' })).toEqual(['mine']);
  expect(await ids({ profile: 'p2' })).toEqual(['theirs']);
});
