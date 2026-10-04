import { requireAdmin } from '@/lib/admin-auth';
import { getDb } from '@/lib/db';
import { getAdminCopy } from '@/i18n/admin-copy';
import { Table } from '@/components/ui/table';
/** Audit trail is intentionally read-only, including for administrators. */
export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  await requireAdmin();
  const page = Math.max(1, Math.floor(Number((await searchParams).page) || 1)),
    t = await getAdminCopy();
  const logs = await getDb().adminAuditLog.findMany({
    orderBy: { createdAt: 'desc' },
    skip: (page - 1) * 50,
    take: 51,
  });
  return (
    <section>
      <h1>{t('admin.nav.audit')}</h1>
      <Table>
        <caption>{t('admin.nav.audit')}</caption>
        <thead>
          <tr>
            {(['time', 'actor', 'action', 'target', 'diff'] as const).map((key) => (
              <th scope="col" key={key}>
                {t(`admin.audit.${key}`)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {logs.slice(0, 50).map((log) => (
            <tr key={log.id}>
              <td>{t('admin.content', { text: log.createdAt.toISOString() })}</td>
              <td>{t('admin.content', { text: log.adminId })}</td>
              <td>{t('admin.content', { text: log.action })}</td>
              <td>{t('admin.content', { text: log.target ?? '' })}</td>
              <td>
                <pre>{t('admin.content', { text: JSON.stringify(log.diff) })}</pre>
              </td>
            </tr>
          ))}
        </tbody>
      </Table>
      {!logs.length && <p>{t('admin.empty')}</p>}
      {page > 1 && <a href={`?page=${page - 1}`}>{t('admin.previous')}</a>}{' '}
      {logs.length > 50 && <a href={`?page=${page + 1}`}>{t('admin.next')}</a>}
    </section>
  );
}
