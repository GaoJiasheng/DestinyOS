import { readFile } from 'node:fs/promises';
import type { KnowledgeBundle, KnowledgeUnit } from '@tianji/content';
import type { System, Locale } from '@tianji/shared';
import { getDb } from './db';
import { resolve } from 'node:path';
import { webDirectory } from './server-resources';
const bundled = new Map<string, Promise<KnowledgeBundle>>();
/** Load validated build-time knowledge; database releases replace published units when available. */
export async function loadKnowledge(system: System, locale: Locale): Promise<KnowledgeBundle> {
  const key = `${system}.${locale}`;
  let bundle = bundled.get(key);
  if (!bundle) {
    // DESIGN-GAP: Build validates the complete corpus; the trusted compiled artifact is typed at this filesystem boundary.
    bundle = readFile(
      resolve(webDirectory(), `../../packages/content/dist/${key}.json`),
      'utf8',
    ).then((text) => JSON.parse(text) as KnowledgeBundle);
    bundled.set(key, bundle);
  }
  const fallback = await bundle;
  if (!process.env.DATABASE_URL) return fallback;
  try {
    const release = await getDb().knowledgeRelease.findFirst({ orderBy: { createdAt: 'desc' } });
    if (!release) return fallback;
    const rows = await getDb().knowledgeUnit.findMany({
      where: { system, status: 'published' },
      orderBy: { version: 'desc' },
    });
    if (!rows.length) return fallback;
    const seen = new Set<string>();
    const units = rows
      .filter((r) => {
        if (seen.has(r.unitId)) return false;
        seen.add(r.unitId);
        return true;
      })
      .map((r) => r.compiled as unknown as KnowledgeUnit);
    return {
      ...fallback,
      knowledgeVersion: release.version,
      units: [...fallback.units.filter((u) => u.system === 'common'), ...units],
    };
  } catch {
    return fallback;
  }
}
