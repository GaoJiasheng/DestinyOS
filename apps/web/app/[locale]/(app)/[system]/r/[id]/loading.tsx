import { getCopy } from '@/i18n/get-copy';
/** Reading placeholder reserves space while the owner snapshot is fetched. */
export default async function Loading() {
  const t = await getCopy();
  return (
    <div className="status-page report-skeleton" role="status">
      {t('report.loading')}
    </div>
  );
}
