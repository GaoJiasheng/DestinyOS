import { stringify } from 'yaml';
import { Prisma } from '@prisma/client';
import { System, type Locale } from '@tianji/shared';
import { interpret, systemConfigs } from '@tianji/interpret';
import type { KnowledgeBundle, KnowledgeUnit } from '@tianji/content';
import {
  validateSource,
  validateRelations,
  checkCoverage,
  type Diagnostic,
  type LocatedUnit,
} from '@tianji/content/validation';
import { getDb } from './db';
import { bundledKnowledge, loadKnowledge } from './knowledge';
import { fixtures, fixtureChart, fixtureNow, validationFixtures } from './admin-fixtures';
import { ApiError } from './api-error';
import { cacheWrite } from './cache';
const json = (value: unknown) => JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
const located = (unit: KnowledgeUnit): LocatedUnit => ({
  unit,
  file: unit.id,
  locate: () => ({ line: 1, column: 1 }),
});
/** Validate one editor entry using the same schema, bilingual content, banned phrases and path rules as CI. */
export async function validateKu(yaml: string) {
  const result = validateSource('editor', yaml, await validationFixtures());
  const diagnostics = [...result.diagnostics];
  if (result.units.length !== 1)
    diagnostics.push({
      file: 'editor',
      line: 1,
      column: 1,
      severity: 'error',
      message: 'Expected exactly one KU',
    });
  const unit = result.units[0]?.unit;
  if (unit?.system === 'common')
    diagnostics.push({
      file: 'editor',
      line: 1,
      column: 1,
      severity: 'error',
      message: 'Common units are maintained in source control',
    });
  if (unit && !Number.isInteger(unit.weight))
    diagnostics.push({
      file: 'editor',
      line: 1,
      column: 1,
      severity: 'error',
      message: 'Database weight requires an integer',
    });
  return { unit, diagnostics, valid: !diagnostics.some((d) => d.severity === 'error') };
}
/** List latest database revisions merged with the shipped corpus so the editor works before a database import. */
export async function listKu() {
  const rows = await getDb().knowledgeUnit.findMany({ orderBy: { version: 'desc' } });
  const heads = new Map<string, KnowledgeUnit>();
  for (const system of Object.values(System)) {
    for (const unit of (await loadKnowledge(system, 'zh')).units)
      if (unit.system !== 'common') heads.set(unit.id, unit);
  }
  const seen = new Set<string>();
  for (const row of rows) {
    if (seen.has(row.unitId)) continue;
    seen.add(row.unitId);
    if (row.status === 'draft' || !heads.has(row.unitId))
      heads.set(row.unitId, row.compiled as unknown as KnowledgeUnit);
  }
  return [...heads.values()].sort((a, b) => a.id.localeCompare(b.id));
}
/** Read a KU's latest revision without exposing any user input or birth information. */
export async function getKu(unitId: string) {
  const row = await getDb().knowledgeUnit.findFirst({
    where: { unitId },
    orderBy: { version: 'desc' },
  });
  if (row?.status === 'draft')
    return { yaml: row.yaml, version: row.version, unit: row.compiled as unknown as KnowledgeUnit };
  const unit = (await listKu()).find((u) => u.id === unitId);
  if (!unit) throw new ApiError('E_NOT_FOUND', 'KU not found', 404);
  return { yaml: stringify([unit]), version: row?.version ?? unit.meta.version, unit };
}
/** Append a draft revision and its audit in one transaction, rejecting concurrent editor overwrites. */
export async function saveKuDraft(
  adminId: string,
  yaml: string,
  unitId: string,
  baseVersion: number,
) {
  const checked = await validateKu(yaml);
  if (!checked.valid || !checked.unit || checked.unit.id !== unitId)
    throw new ApiError('E_VALIDATION', 'Invalid KU', 400);
  const current = await getKu(unitId);
  const unit = checked.unit;
  return getDb().$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(6060)`;
    const latest = await tx.knowledgeUnit.findFirst({
      where: { unitId },
      orderBy: { version: 'desc' },
    });
    const version = latest?.version ?? current.version;
    if (baseVersion !== version)
      throw new ApiError('E_VALIDATION', 'Concurrent revision; reload the editor', 409);
    unit.meta = {
      ...unit.meta,
      version: version + 1,
      status: 'draft',
      author: adminId,
      reviewed_by: null,
    };
    await tx.knowledgeUnit.updateMany({
      where: { unitId, status: 'draft' },
      data: { status: 'deprecated' },
    });
    const row = await tx.knowledgeUnit.create({
      data: {
        unitId,
        version: version + 1,
        system: System[unit.system as System],
        section: unit.section,
        topic: unit.topic,
        status: 'draft',
        yaml: stringify([unit]),
        compiled: json(unit),
        weight: unit.weight,
        polarity: unit.polarity,
        author: adminId,
      },
    });
    await tx.adminAuditLog.create({
      data: {
        adminId,
        action: 'ku.draft',
        target: unitId,
        diff: { from: version, to: row.version },
      },
    });
    return { version: row.version, yaml: row.yaml };
  });
}
/** Render both report locales against a selected fixture, highlighting whether the edited unit was actually selected. */
export async function previewKu(yaml: string, fixture: (typeof fixtures)[number]) {
  const checked = await validateKu(yaml);
  if (!checked.valid || !checked.unit || checked.unit.system === 'common')
    return { diagnostics: checked.diagnostics, previews: [] };
  const unit = { ...checked.unit, meta: { ...checked.unit.meta, status: 'published' as const } };
  const system = checked.unit.system;
  const base = await loadKnowledge(system, 'zh');
  const knowledge = { ...base, units: [...base.units.filter((u) => u.id !== unit.id), unit] };
  const chart = await fixtureChart(system, fixture, knowledge);
  return {
    diagnostics: checked.diagnostics,
    previews: (['zh', 'en'] as Locale[]).map((locale) => {
      const report = interpret({
        system,
        chart,
        locale,
        knowledge,
        context: { now: fixtureNow, profileHasTime: fixture !== 'E' },
      });
      return { locale, matched: report.hits.some((h) => h.unitId === unit.id), report };
    }),
  };
}
type Bundles = Record<System, KnowledgeBundle>;
async function fallbackBundles(): Promise<Bundles> {
  const entries = await Promise.all(
    Object.values(System).map(
      async (system) => [system, await bundledKnowledge(system, 'zh')] as const,
    ),
  );
  return Object.fromEntries(entries) as Bundles;
}
async function checkBundles(bundles: Bundles, baseline: Bundles) {
  const corpus = new Map<string, KnowledgeUnit>();
  const errors: Diagnostic[] = [];
  const coverage: { system: System; errors: string[] }[] = [];
  const frozen = await validationFixtures();
  for (const system of Object.values(System)) {
    const units = bundles[system].units;
    for (const unit of units) {
      corpus.set(unit.id, unit);
      errors.push(
        ...validateSource(unit.id, stringify([unit]), frozen).diagnostics.filter(
          (d) => d.severity === 'error',
        ),
      );
    }
    const charts = frozen[system] ?? [];
    const sections = systemConfigs[system].sectionPlan.map((s) => s.key);
    const missing = checkCoverage(units, charts, sections);
    coverage.push({ system, errors: missing });
    // DESIGN-GAP: Preflight displays existing corpus gaps and blocks newly introduced gaps; M5 does not rewrite the approved M2 corpus.
    const previous = new Set(checkCoverage(baseline[system].units, charts, sections));
    errors.push(
      ...missing
        .filter((message) => !previous.has(message))
        .map((message) => ({
          file: system,
          line: 1,
          column: 1,
          severity: 'error' as const,
          message,
        })),
    );
  }
  errors.push(
    ...validateRelations([...corpus.values()].map(located)).filter((d) => d.severity === 'error'),
  );
  return { errors, coverage };
}
/** Preflight or publish all selected latest drafts; rollback publishes the immutable old snapshot as a new semantic version. */
export async function publishRelease(
  adminId: string,
  notes: string,
  draftIds: string[],
  rollback?: string,
  dryRun = false,
) {
  const fallback = await fallbackBundles();
  return getDb().$transaction(
    async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(6060)`;
      const latest = await tx.knowledgeRelease.findFirst({
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      });
      const baseline = latest?.bundles ? (latest.bundles as unknown as Bundles) : fallback;
      let candidate = structuredClone(baseline);
      if (rollback) {
        const source = await tx.knowledgeRelease.findUnique({ where: { version: rollback } });
        if (!source?.bundles) throw new ApiError('E_NOT_FOUND', 'Release not found', 404);
        candidate = structuredClone(source.bundles as unknown as Bundles);
      } else {
        if (!draftIds.length) throw new ApiError('E_VALIDATION', 'Select drafts', 400);
        const drafts = await tx.knowledgeUnit.findMany({
          where: { id: { in: draftIds }, status: 'draft' },
        });
        if (drafts.length !== draftIds.length)
          throw new ApiError('E_VALIDATION', 'Draft selection changed', 409);
        for (const row of drafts) {
          const newest = await tx.knowledgeUnit.findFirst({
            where: { unitId: row.unitId },
            orderBy: { version: 'desc' },
          });
          if (newest?.id !== row.id)
            throw new ApiError('E_VALIDATION', 'Stale draft selection', 409);
          const unit = row.compiled as unknown as KnowledgeUnit;
          const published = {
            ...unit,
            meta: { ...unit.meta, status: 'published' as const, reviewed_by: adminId },
          };
          candidate[row.system].units = [
            ...candidate[row.system].units.filter((u) => u.id !== unit.id),
            published,
          ];
        }
      }
      const check = await checkBundles(candidate, baseline);
      if (dryRun || check.errors.length) return { ...check, version: null };
      const base = latest?.version ?? fallback.bazi.knowledgeVersion;
      // DESIGN-GAP: Archive the shipped baseline on the first publication so the first edit can also be rolled back.
      if (!latest)
        await tx.knowledgeRelease.create({
          data: { version: base, createdBy: adminId, bundles: json(fallback) },
        });
      const parts = /^\d+\.\d+\.\d+$/.test(base) ? base.split('.').map(Number) : [1, 0, 0];
      const version = `${parts[0]}.${parts[1]}.${parts[2]! + 1}`;
      for (const system of Object.values(System)) candidate[system].knowledgeVersion = version;
      await tx.knowledgeRelease.create({
        data: { version, notes, createdBy: adminId, bundles: json(candidate) },
      });
      if (!rollback)
        for (const id of draftIds) {
          const row = await tx.knowledgeUnit.findUniqueOrThrow({ where: { id } });
          const unit = row.compiled as unknown as KnowledgeUnit;
          unit.meta = { ...unit.meta, status: 'published', reviewed_by: adminId };
          await tx.knowledgeUnit.update({
            where: { id },
            data: {
              status: 'published',
              publishedAt: new Date(),
              reviewedBy: adminId,
              compiled: json(unit),
              yaml: stringify([unit]),
            },
          });
        }
      await tx.adminAuditLog.create({
        data: {
          adminId,
          action: rollback ? 'ku.rollback' : 'ku.publish',
          target: version,
          diff: { draftIds, rollback: rollback ?? null, initialVersion: latest ? null : base },
        },
      });
      // Refresh after commit is performed by the action; version keys prevent stale cached reports.
      return { ...check, version };
    },
    { timeout: 60000, maxWait: 10000 },
  );
}
/** Populate the new immutable version keys; cache outages fall back to the committed database snapshot. */
export async function refreshRelease(version: string) {
  for (const system of Object.values(System))
    for (const locale of ['zh', 'en'] as const) {
      try {
        await cacheWrite(
          `knowledge:${version}:${system}:${locale}`,
          await loadKnowledge(system, locale, version),
          3600,
        );
      } catch {
        /* DB fallback remains valid. */
      }
    }
}
