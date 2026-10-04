import { requireAdmin } from '@/lib/admin-auth';
import { siteConfig } from '@/lib/site-config';
import { getAdminCopy } from '@/i18n/admin-copy';
import { ConfigEditor } from '@/components/admin/config-editor';
/** Edit supported live settings with bilingual announcements and bounded scheduling. */
export default async function ConfigPage() {
  await requireAdmin();
  const t = await getAdminCopy();
  return (
    <section>
      <h1>{t('admin.nav.config')}</h1>
      <ConfigEditor initial={await siteConfig()} />
    </section>
  );
}
