import { readFile } from 'node:fs/promises';
import { PrismaClient, Prisma } from '@prisma/client';
import { stringify } from 'yaml';
import { localAdapter } from '../apps/web/lib/db-local';
import { snapshotParts, loadSnapshot } from '../apps/web/lib/db-snapshot';
import { System } from '../packages/shared/src';
import type { KnowledgeBundle, KnowledgeUnit } from '../packages/content/src';

const json = (value: unknown): Prisma.InputJsonValue =>
  JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
/** Import validated compiled content atomically, preserving immutable releases and published unit revisions. */
export async function importContent(db: PrismaClient): Promise<{ version: string; units: number }> {
  const bundles: Partial<Record<System, KnowledgeBundle>> = {};
  const units = new Map<string, KnowledgeUnit>();
  let version: string | undefined;
  for (const system of Object.values(System)) {
    const bundle = JSON.parse(
      await readFile(`packages/content/dist/${system}.zh.json`, 'utf8'),
    ) as KnowledgeBundle;
    if (version && bundle.knowledgeVersion !== version)
      throw new Error('Mixed compiled knowledge versions');
    version = bundle.knowledgeVersion;
    bundles[system] = bundle;
    // DESIGN-GAP: The documented Prisma System enum omits common; shared units remain in every immutable bundle without adding an enum value.
    for (const unit of bundle.units) if (unit.system !== 'common') units.set(unit.id, unit);
  }
  if (!version) throw new Error('Missing compiled knowledge version');
  const releaseVersion = version;
  // DESIGN-GAP: Initial imports use the explicit system identity content:import, not an invented admin account; repeats cannot overwrite a release.
  await db.$transaction(
    async (tx) => {
      const existing = await tx.knowledgeRelease.findUnique({ where: { version: releaseVersion } });
      if (existing) {
        if (JSON.stringify(existing.bundles) !== JSON.stringify(bundles)) {
          // Compare canonical JSON values to preserve immutable content.
          assertEquivalent(await loadSnapshot(existing.version, existing.bundles, tx), bundles);
        }
        return;
      }
      const current = new Map(
        (
          await tx.knowledgeUnit.findMany({
            select: { unitId: true, version: true, compiled: true },
          })
        ).map((row) => [`${row.unitId}:${row.version}`, row.compiled]),
      );
      const pending: Prisma.KnowledgeUnitCreateManyInput[] = [];
      for (const unit of units.values()) {
        const row = current.get(`${unit.id}:${unit.meta.version}`);
        if (row) {
          assertEquivalent(row, unit);
          continue;
        }
        pending.push({
          unitId: unit.id,
          version: unit.meta.version,
          system: unit.system as System,
          section: unit.section,
          topic: unit.topic,
          status: 'published',
          yaml: stringify([unit]),
          compiled: json(unit),
          weight: unit.weight,
          polarity: unit.polarity,
          author: unit.meta.author,
          reviewedBy: unit.meta.reviewed_by,
          publishedAt: new Date(),
        });
      }
      // DESIGN-GAP: Bound SQLite insert parameter counts while importing the entire corpus in one local transaction.
      for (let offset = 0; offset < pending.length; offset += 50)
        await tx.knowledgeUnit.createMany({ data: pending.slice(offset, offset + 50) });
      await tx.knowledgeRelease.create({
        data: {
          version: releaseVersion,
          createdBy: 'content:import',
          notes: 'Validated source import',
          bundles: json(snapshotParts(bundles).manifest),
        },
      });
      await tx.knowledgeBundleChunk.createMany({
        data: snapshotParts(bundles).chunks.map((chunk) => ({ releaseVersion, ...chunk })),
      });
    },
    { timeout: 120000, maxWait: 10000 },
  );
  return { version: releaseVersion, units: units.size };
}
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object')
    return `{${Object.entries(value)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`)
      .join(',')}}`;
  return JSON.stringify(value) ?? 'null';
}
function assertEquivalent(left: unknown, right: unknown) {
  if (canonical(left) !== canonical(right))
    throw new Error(
      'Published content conflict: increase unit/release version; immutable content was not overwritten',
    );
}
if (process.argv[1]?.endsWith('content-import.ts')) {
  const db = new PrismaClient({ adapter: localAdapter() });
  try {
    console.log(await importContent(db));
  } finally {
    await db.$disconnect();
  }
}
