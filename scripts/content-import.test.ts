import { afterAll, beforeAll, expect, it } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';
import { PrismaClient } from '@prisma/client';
import { readFile, readdir } from 'node:fs/promises';
import { importContent } from './content-import';
const pg = new PGlite();
const server = new PGLiteSocketServer({ db: pg, port: 0, maxConnections: 1 });
let db: PrismaClient;
beforeAll(async () => {
  const folders = await readdir('prisma/migrations', { withFileTypes: true });
  for (const folder of folders
    .filter((f) => f.isDirectory())
    .sort((a, b) => a.name.localeCompare(b.name)))
    await pg.exec(await readFile(`prisma/migrations/${folder.name}/migration.sql`, 'utf8'));
  await server.start();
  db = new PrismaClient({
    datasourceUrl: `postgresql://test:test@${server.getServerConn()}/postgres?connection_limit=1&statement_cache_size=0`,
  });
}, 30000);
afterAll(async () => {
  await db?.$disconnect();
  await server.stop();
  // DESIGN-GAP: The socket adapter schedules close/detach with setImmediate; drain it before
  // destroying PGlite's WASM backend so delayed handlers can inspect transaction state.
  await new Promise<void>((resolve) => setImmediate(resolve));
  await pg.close();
});
it('imports the compiled production corpus twice without duplicates and rejects changed published content atomically', async () => {
  const first = await importContent(db);
  expect(first.units).toBeGreaterThan(2500);
  const count = await db.knowledgeUnit.count();
  expect(await importContent(db)).toEqual(first);
  expect(await db.knowledgeUnit.count()).toBe(count);
  expect(await db.knowledgeRelease.count()).toBe(1);
  const release = await db.knowledgeRelease.findUniqueOrThrow({
    where: { version: first.version },
  });
  await db.knowledgeRelease.update({
    where: { id: release.id },
    data: { bundles: { corrupted: true } },
  });
  await expect(importContent(db)).rejects.toThrow('Published content conflict');
  expect(await db.knowledgeUnit.count()).toBe(count);
  expect(
    (await db.knowledgeRelease.findUniqueOrThrow({ where: { id: release.id } })).bundles,
  ).toEqual({ corrupted: true });
}, 120000);
