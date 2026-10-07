import { resourceText } from './platform/resources';
import type { KnowledgeBundle } from '@tianji/content';
import type { System, Locale } from '@tianji/shared';
const bundled = new Map<string, Promise<KnowledgeBundle>>();
// DESIGN-GAP: Immutable versioned snapshots have an isolate-local, bounded cache; the release pointer is still checked on every request.
const published = new Map<string, KnowledgeBundle>();
/** Read the validated build-time fallback without resolving a database release. */
export async function bundledKnowledge(system: System, locale: Locale): Promise<KnowledgeBundle> {
  const key = `${system}.${locale}`;
  let bundle = bundled.get(key);
  if (!bundle) {
    // DESIGN-GAP: Build validates the complete corpus; trusted compiled artifacts are typed at this filesystem boundary.
    bundle = resourceText(`../../packages/content/dist/${key}.json`)
      .then((text) => JSON.parse(text) as KnowledgeBundle)
      .catch((error: unknown) => {
        bundled.delete(key);
        throw error;
      });
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
  if (process.env.NEXT_PHASE === 'phase-production-build' || version === fallback.knowledgeVersion)
    return fallback;
  try {
    // DESIGN-GAP: Published snapshots need ORM only after the immutable fallback/version fast path.
    const [{ getDb }, { cacheRead, cacheWrite }] = await Promise.all([
      import('./db'),
      import('./cache'),
    ]);
    const release = version
      ? await getDb().knowledgeRelease.findUnique({ where: { version }, select: { version: true } })
      : await getDb().knowledgeRelease.findFirst({
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          select: { version: true },
        });
    if (!release) return fallback;
    const key = `knowledge:${release.version}:${system}:${locale}`;
    const inMemory = published.get(key);
    if (inMemory) return inMemory;
    const remember = (bundle: KnowledgeBundle) => {
      if (published.size >= 24) published.delete(published.keys().next().value!);
      published.set(key, bundle);
      return bundle;
    };
    try {
      const cached = await cacheRead<KnowledgeBundle>(key);
      if (cached) return remember(cached);
    } catch {
      /* Use DB snapshot. */
    }
    // DESIGN-GAP: Release bundles are application-validated on publication, stored as immutable JSON by system.
    const stored = await getDb().knowledgeRelease.findUnique({
      where: { version: release.version },
      select: { bundles: true },
    });
    if (!stored?.bundles) return fallback;
    const { loadSnapshot } = await import('./db-snapshot');
    const snapshots = (await loadSnapshot(
      release.version,
      stored.bundles,
      undefined,
      system,
    )) as Partial<Record<System, KnowledgeBundle>>;
    const snapshot = snapshots[system];
    if (!snapshot) return fallback;
    const bundle = { ...snapshot, knowledgeVersion: release.version };
    try {
      await cacheWrite(key, bundle, 3600);
    } catch {
      /* Cache outages do not change the release. */
    }
    return remember(bundle);
  } catch {
    return fallback;
  }
}
