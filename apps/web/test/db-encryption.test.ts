import { beforeAll, afterAll, expect, it, vi } from 'vitest';
import { readFile, readdir } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';
import { PrismaClient } from '@prisma/client';
import { fieldEncryptionExtension } from '../lib/db-encryption';
import { encryptField, decryptField } from '../lib/crypto';
import { rotateKeys } from '../../../scripts/rotate-keys';

const pg = new PGlite();
const server = new PGLiteSocketServer({ db: pg, port: 0, maxConnections: 1 });
let raw: PrismaClient;
// Keep the concrete extended client type inferred by its extension.
function extend(client: PrismaClient) {
  return client.$extends(fieldEncryptionExtension());
}
let encryptedDb: ReturnType<typeof extend>;

beforeAll(async () => {
  vi.stubEnv('FIELD_ENCRYPTION_KEYS', `v1:${Buffer.alloc(32, 1).toString('base64')}`);
  const migrations = await readdir('prisma/migrations', { withFileTypes: true });
  for (const migration of migrations
    .filter((entry) => entry.isDirectory())
    .sort((a, b) => a.name.localeCompare(b.name)))
    await pg.exec(await readFile(`prisma/migrations/${migration.name}/migration.sql`, 'utf8'));
  await server.start();
  raw = new PrismaClient({
    datasourceUrl: `postgresql://test:test@${server.getServerConn()}/postgres?connection_limit=1&statement_cache_size=0`,
  });
  encryptedDb = extend(raw);
}, 30_000);
afterAll(async () => {
  await raw?.$disconnect();
  await server.stop();
  // DESIGN-GAP: Drain the adapter's deferred close handlers before destroying its database.
  await new Promise<void>((resolve) => setImmediate(resolve));
  await pg.close();
  vi.unstubAllEnvs();
});

it('rotates real raw database ciphertext in 500-row batches and rolls back a tampered batch', async () => {
  const user = await raw.user.create({ data: { email: 'rotation@example.test' } });
  const old = `v1:${Buffer.alloc(32, 1).toString('base64')}`;
  const current = `v2:${Buffer.alloc(32, 2).toString('base64')}`;
  await raw.birthProfile.createMany({
    data: Array.from({ length: 501 }, (_, index) => ({
      id: `rotation-${String(index).padStart(4, '0')}`,
      userId: user.id,
      version: index + 1,
      encBirth: encryptField('private birth', 'BirthProfile.encBirth', user.id, old),
      encPlace: encryptField('private city', 'BirthProfile.encPlace', user.id, old),
      encName: null,
      gender: 'unspecified',
      timeUnknown: true,
      tz: 'UTC',
      birthYear: 1990,
      chartHash: 'rotation',
    })),
  });
  const first = await raw.birthProfile.findUniqueOrThrow({ where: { id: 'rotation-0000' } });
  await raw.birthProfile.update({ where: { id: 'rotation-0001' }, data: { encBirth: 'tampered' } });
  vi.stubEnv('FIELD_ENCRYPTION_KEYS', `${current},${old}`);
  await expect(rotateKeys(raw)).rejects.toThrow();
  expect((await raw.birthProfile.findUniqueOrThrow({ where: { id: first.id } })).encBirth).toBe(
    first.encBirth,
  );
  await raw.birthProfile.update({
    where: { id: 'rotation-0001' },
    data: {
      encBirth: encryptField('private birth', 'BirthProfile.encBirth', user.id, old),
    },
  });
  await rotateKeys(raw);
  const rows = await raw.birthProfile.findMany({ where: { userId: user.id } });
  expect(rows).toHaveLength(501);
  for (const row of rows) {
    expect(row.encBirth).toMatch(/^v2:/);
    expect(decryptField(row.encBirth, 'BirthProfile.encBirth', user.id, current)).toBe(
      'private birth',
    );
    expect(decryptField(row.encPlace!, 'BirthProfile.encPlace', user.id, current)).toBe(
      'private city',
    );
  }
});

it('encrypts all profile fields at rest and decrypts creates, projections, nested reads and updates', async () => {
  vi.stubEnv('FIELD_ENCRYPTION_KEYS', `v1:${Buffer.alloc(32, 1).toString('base64')}`);
  const user = await encryptedDb.user.create({ data: { email: 'crypto@example.com' } });
  const data = {
    userId: user.id,
    encBirth: '{"year":1990,"month":6,"day":15}',
    encPlace: '{"name":"Singapore"}',
    encName: '我',
    gender: 'unspecified' as const,
    timeUnknown: true,
    tz: 'Asia/Singapore',
    birthYear: 1990,
    chartHash: 'hash',
  };
  const row = await encryptedDb.birthProfile.create({ data });
  expect(row.encBirth).toBe(data.encBirth);
  const stored = await raw.birthProfile.findUniqueOrThrow({ where: { id: row.id } });
  for (const field of ['encBirth', 'encPlace', 'encName'] as const)
    expect(stored[field]).toMatch(/^v1:/);
  expect(stored.encPlace).not.toContain('Singapore');
  expect(stored.encBirth).not.toContain(data.encBirth);
  const omitted = await encryptedDb.birthProfile.findUniqueOrThrow({
    where: { id: row.id },
    omit: { userId: true },
  });
  expect(omitted.encBirth).toBe(data.encBirth);
  expect(omitted).not.toHaveProperty('userId');
  expect(
    await encryptedDb.birthProfile.findUnique({
      where: { id: row.id },
      select: { encBirth: true, encPlace: true },
    }),
  ).toEqual({ encBirth: data.encBirth, encPlace: data.encPlace });
  const related = await encryptedDb.user.findUniqueOrThrow({
    where: { id: user.id },
    select: { profiles: { select: { encName: true } } },
  });
  expect(related.profiles).toEqual([{ encName: '我' }]);
  const update = await encryptedDb.birthProfile.update({
    where: { id: row.id, userId: user.id },
    data: { encName: { set: 'new name' }, encPlace: null },
  });
  expect(update.encName).toBe('new name');
  expect(update.encPlace).toBeNull();
  await expect(
    encryptedDb.birthProfile.findMany({ where: { OR: [{ encName: 'new name' }] } }),
  ).rejects.toThrow('where');
  await expect(
    encryptedDb.birthProfile.updateMany({ data: { encName: 'unsafe' } }),
  ).rejects.toThrow('bulk');
  await expect(
    encryptedDb.birthProfile.update({
      where: { id: row.id, userId: user.id },
      data: { userId: { set: 'other' } },
    }),
  ).rejects.toThrow('ownership');
  await expect(
    encryptedDb.user.update({
      where: { id: user.id },
      data: {
        profiles: {
          update: { where: { id: row.id, userId: user.id }, data: { encName: 'unsafe' } },
        },
      },
    }),
  ).rejects.toThrow('nested');
});

it('encrypts reading snapshots, strips chart PII and round-trips createMany/upsert/transactions under rotation', async () => {
  const user = await encryptedDb.user.findUniqueOrThrow({ where: { email: 'crypto@example.com' } });
  const reading = await encryptedDb.reading.create({
    data: {
      userId: user.id,
      system: 'bazi',
      encInput: '{"question":"private"}',
      chart: {
        input: { year: 1990 },
        pillars: ['甲子'],
        meta: { local: '1990-06-15', solarTimeAdjust: { offsetMinutes: 3 } },
      },
      schoolUsed: {},
      engineVersion: '1',
      interpretVersion: '1',
      knowledgeVersion: '1',
    },
  });
  expect(reading.encInput).toContain('private');
  expect(reading.chart).toEqual({
    pillars: ['甲子'],
    meta: { solarTimeAdjust: { offsetMinutes: 3 } },
  });
  expect((await raw.reading.findUniqueOrThrow({ where: { id: reading.id } })).encInput).toMatch(
    /^v1:/,
  );
  vi.stubEnv(
    'FIELD_ENCRYPTION_KEYS',
    `v2:${Buffer.alloc(32, 2).toString('base64')},v1:${Buffer.alloc(32, 1).toString('base64')}`,
  );
  expect(
    (await encryptedDb.reading.findUniqueOrThrow({ where: { id: reading.id } })).encInput,
  ).toContain('private');
  await encryptedDb.$transaction(async (tx) => {
    await tx.reading.update({
      where: { id: reading.id, userId: user.id },
      data: { encInput: 'rotated' },
    });
  });
  expect((await raw.reading.findUniqueOrThrow({ where: { id: reading.id } })).encInput).toMatch(
    /^v2:/,
  );
  const base = {
    userId: user.id,
    encBirth: '{}',
    gender: 'unspecified' as const,
    timeUnknown: true,
    tz: 'UTC',
    birthYear: 1990,
    chartHash: 'many',
  };
  await encryptedDb.birthProfile.createMany({
    data: [
      { ...base, version: 2 },
      { ...base, version: 3 },
    ],
  });
  expect(
    (await raw.birthProfile.findMany({ where: { userId: user.id, version: { gt: 1 } } })).every(
      (row) => row.encBirth.startsWith('v2:'),
    ),
  ).toBe(true);
  const upsert = await encryptedDb.birthProfile.upsert({
    where: { id: `upsert-${user.id}`, userId: user.id },
    create: { ...base, id: `upsert-${user.id}`, version: 4 },
    update: { encBirth: '{}' },
    select: { encBirth: true },
  });
  expect(upsert).toEqual({ encBirth: '{}' });
  // High-risk regression: upsert must not transplant owner-bound ciphertext or replace its owner.
  const existing = await raw.birthProfile.findUniqueOrThrow({
    where: { id: `upsert-${user.id}`, userId: user.id },
  });
  await expect(
    encryptedDb.birthProfile.upsert({
      where: { id: existing.id },
      create: { ...base, version: 5 },
      update: { userId: 'other-owner' },
    }),
  ).rejects.toThrow('ownership');
  await expect(
    encryptedDb.birthProfile.upsert({
      where: { id: existing.id },
      create: { ...base, version: 5 },
      update: { encBirth: 'attacker-replacement' },
    }),
  ).rejects.toThrow('where.userId');
  expect((await raw.birthProfile.findUniqueOrThrow({ where: { id: existing.id } })).encBirth).toBe(
    existing.encBirth,
  );
  await expect(
    encryptedDb.reading.create({
      data: {
        system: 'bazi',
        encInput: 'anonymous',
        chart: {},
        schoolUsed: {},
        engineVersion: '1',
        interpretVersion: '1',
        knowledgeVersion: '1',
      },
    }),
  ).rejects.toThrow('userId');
});
