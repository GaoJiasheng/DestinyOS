import { getAdminCopy } from '@/i18n/admin-copy';
/** Announce pending navigation for all secured administrator pages. */
export default async function AdminLoading() {
  const t = await getAdminCopy();
  return (
    <p role="status" aria-busy="true">
      {t('admin.pending')}
    </p>
  );
}
