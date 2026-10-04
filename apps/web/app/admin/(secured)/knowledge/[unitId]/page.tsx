import { notFound } from 'next/navigation';
import { requireAdmin } from '@/lib/admin-auth';
import { getKu } from '@/lib/admin-knowledge';
import { getAdminCopy } from '@/i18n/admin-copy';
import { KnowledgeEditor } from '@/components/admin/knowledge-editor';
/** YAML editor with live CI validation and bilingual fixture reports. */
export default async function KuPage({ params }: { params: Promise<{ unitId: string }> }) {
  await requireAdmin();
  const item = await getKu((await params).unitId).catch(() => notFound()),
    t = await getAdminCopy();
  return (
    <section>
      <h1>{t('admin.ku.editor')}</h1>
      <KnowledgeEditor
        unitId={item.unit.id}
        initialYaml={item.yaml}
        initialVersion={item.version}
      />
    </section>
  );
}
