import { readFile } from 'node:fs/promises';
import { PrismaClient, Prisma } from '@prisma/client';
import { stringify } from 'yaml';
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
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(6060)`;
      const existing = await tx.knowledgeRelease.findUnique({ where: { version: releaseVersion } });
      if (existing) {
        if (JSON.stringify(existing.bundles) !== JSON.stringify(bundles)) {
          // PostgreSQL JSONB key order is not stable; compare canonical JSON values.
          assertEquivalent(existing.bundles, bundles);
        }
        return;
      }
      for (const unit of units.values()) {
        const row = await tx.knowledgeUnit.findUnique({
          where: { unitId_version: { unitId: unit.id, version: unit.meta.version } },
        });
        if (row) {
          assertEquivalent(row.compiled, unit);
          continue;
        }
        await tx.knowledgeUnit.create({
          data: {
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
          },
        });
      }
      await tx.knowledgeRelease.create({
        data: {
          version: releaseVersion,
          createdBy: 'content:import',
          notes: 'Validated source import',
          bundles: json(bundles),
        },
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
  const db = new PrismaClient();
  try {
    console.log(await importContent(db));
  } finally {
    await db.$disconnect();
  }
}
