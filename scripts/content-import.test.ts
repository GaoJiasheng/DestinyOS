import { isolatedSqlite } from './sqlite-test';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { importContent } from './content-import';
const pg = isolatedSqlite();
let db: PrismaClient;
beforeAll(async () => {
  db = pg.client;
}, 30000);
afterAll(async () => {
  await db?.$disconnect();
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
