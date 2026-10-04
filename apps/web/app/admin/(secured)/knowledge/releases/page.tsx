import { requireAdmin } from '@/lib/admin-auth';
import { getDb } from '@/lib/db';
import { getAdminCopy } from '@/i18n/admin-copy';
import { ReleaseManager } from '@/components/admin/release-manager';
/** Select latest drafts, preflight releases, and republish historical immutable versions. */
export default async function ReleasesPage() {
  await requireAdmin();
  const db = getDb();
  const drafts = await db.knowledgeUnit.findMany({
    where: { status: 'draft' },
    orderBy: { version: 'desc' },
    select: { id: true, unitId: true, version: true },
  });
  const seen = new Set<string>();
  const heads = drafts.filter((row) => {
    if (seen.has(row.unitId)) return false;
    seen.add(row.unitId);
    return true;
  });
  const releases = await db.knowledgeRelease.findMany({
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: 100,
    select: { version: true, notes: true, createdAt: true },
  });
  const t = await getAdminCopy();
  return (
    <section>
      <h1>{t('admin.nav.releases')}</h1>
      <ReleaseManager
        drafts={heads}
        releases={releases.map((row) => ({ ...row, createdAt: row.createdAt.toISOString() }))}
      />
    </section>
  );
}
