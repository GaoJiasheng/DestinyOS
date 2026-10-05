import { readFile } from 'node:fs/promises';
import type { KnowledgeBundle } from '@tianji/content';
import type { System, Locale } from '@tianji/shared';
import { getDb } from './db';
import { resolve } from 'node:path';
import { webDirectory } from './server-resources';
import { cacheRead, cacheWrite } from './cache';
const bundled = new Map<string, Promise<KnowledgeBundle>>();
/** Read the validated build-time fallback without resolving a database release. */
export async function bundledKnowledge(system: System, locale: Locale): Promise<KnowledgeBundle> {
  const key = `${system}.${locale === 'en' ? 'en' : 'zh'}`;
  let bundle = bundled.get(key);
  if (!bundle) {
    // DESIGN-GAP: Build validates the complete corpus; trusted compiled artifacts are typed at this filesystem boundary.
    bundle = readFile(
      resolve(webDirectory(), `../../packages/content/dist/${key}.json`),
      'utf8',
    ).then((text) => JSON.parse(text) as KnowledgeBundle);
    bundled.set(key, bundle);
  }
  return bundle;
}
/** Load immutable published bundles; an explicit version preserves old snapshots during delayed translation. */
export async function loadKnowledge(
  system: System,
  locale: Locale,
  version?: string,
): Promise<KnowledgeBundle> {
  const fallback = await bundledKnowledge(system, locale);
  if (!process.env.DATABASE_URL || version === fallback.knowledgeVersion) return fallback;
  try {
    const release = version
      ? await getDb().knowledgeRelease.findUnique({ where: { version }, select: { version: true } })
      : await getDb().knowledgeRelease.findFirst({
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          select: { version: true },
        });
    if (!release) return fallback;
    const key = `knowledge:${release.version}:${system}:${locale}`;
    try {
      const cached = await cacheRead<KnowledgeBundle>(key);
      if (cached) return cached;
    } catch {
      /* Use DB snapshot. */
    }
    // DESIGN-GAP: Release bundles are application-validated on publication, stored as immutable JSON by system.
    const stored = await getDb().knowledgeRelease.findUnique({
      where: { version: release.version },
      select: { bundles: true },
    });
    if (!stored?.bundles) return fallback;
    const snapshots = stored.bundles as unknown as Partial<Record<System, KnowledgeBundle>>;
    const snapshot = snapshots[system];
    if (!snapshot) return fallback;
    const bundle = { ...snapshot, knowledgeVersion: release.version };
    try {
      await cacheWrite(key, bundle, 3600);
    } catch {
      /* Cache outages do not change the release. */
    }
    return bundle;
  } catch {
    return fallback;
  }
}
