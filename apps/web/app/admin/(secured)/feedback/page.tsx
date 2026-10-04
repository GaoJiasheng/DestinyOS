import { requireAdmin } from '@/lib/admin-auth';
import { getDb } from '@/lib/db';
import { getAdminCopy } from '@/i18n/admin-copy';
import { Table } from '@/components/ui/table';
import { AdminActionForm } from '@/components/admin/action-form';
import { deleteFeedbackTextAction, processFeedbackAction } from '../../actions';
/** Aggregate votes by KU, while keeping text private and paginating moderation records. */
export default async function FeedbackPage({
  searchParams,
}: {
  searchParams: Promise<{ unitId?: string; page?: string }>;
}) {
  await requireAdmin();
  const query = await searchParams,
    t = await getAdminCopy(),
    db = getDb();
  const page = Math.max(1, Math.floor(Number(query.page) || 1));
  const votes = await db.feedback.groupBy({ by: ['unitId', 'vote'], _count: true });
  const grouped = new Map<string, { positive: number; negative: number }>();
  for (const row of votes) {
    const key = row.unitId ?? '',
      group = grouped.get(key) ?? { positive: 0, negative: 0 };
    if (row.vote > 0) group.positive += row._count;
    else group.negative += row._count;
    grouped.set(key, group);
  }
  const rows = await db.feedback.findMany({
    where: query.unitId ? { unitId: query.unitId } : {},
    orderBy: { createdAt: 'desc' },
    skip: (page - 1) * 50,
    take: 51,
  });
  return (
    <section>
      <h1>{t('admin.nav.feedback')}</h1>
      <Table>
        <caption>{t('admin.feedback.votes')}</caption>
        <thead>
          <tr>
            <th scope="col">{t('admin.ku.unitId')}</th>
            <th scope="col">{t('admin.feedback.positive')}</th>
            <th scope="col">{t('admin.feedback.negative')}</th>
            <th scope="col">{t('admin.feedback.ratio')}</th>
          </tr>
        </thead>
        <tbody>
          {[...grouped].map(([unitId, group]) => (
            <tr key={unitId}>
              <td>
                {unitId ? (
                  <a href={`?unitId=${encodeURIComponent(unitId)}`}>
                    {t('admin.content', { text: unitId })}
                  </a>
                ) : (
                  t('admin.empty')
                )}
              </td>
              <td>{t('admin.number', { value: group.positive })}</td>
              <td>{t('admin.number', { value: group.negative })}</td>
              <td>
                {t('admin.percent', {
                  value: (100 * group.positive) / (group.positive + group.negative),
                })}
              </td>
            </tr>
          ))}
        </tbody>
      </Table>
      {rows.slice(0, 50).map((row) => (
        <article className="admin-panel" key={row.id}>
          {row.unitId && (
            <a href={`/admin/knowledge/${row.unitId}`}>
              {t('admin.feedback.editKu', { unitId: row.unitId })}
            </a>
          )}
          <p>
            {row.text && row.createdAt.getTime() > Date.now() - 30 * 86400000
              ? t('admin.content', { text: row.text })
              : t('admin.feedback.noText')}
          </p>
          <p>{t(row.processedAt ? 'admin.feedback.processed' : 'admin.feedback.pending')}</p>
          <AdminActionForm action={deleteFeedbackTextAction} label={t('admin.feedback.deleteText')}>
            <input type="hidden" name="id" value={row.id} />
          </AdminActionForm>
          <AdminActionForm action={processFeedbackAction} label={t('admin.feedback.process')}>
            <input type="hidden" name="id" value={row.id} />
          </AdminActionForm>
        </article>
      ))}
      {!rows.length && <p>{t('admin.empty')}</p>}
      {page > 1 && (
        <a href={`?page=${page - 1}&unitId=${encodeURIComponent(query.unitId ?? '')}`}>
          {t('admin.previous')}
        </a>
      )}{' '}
      {rows.length > 50 && (
        <a href={`?page=${page + 1}&unitId=${encodeURIComponent(query.unitId ?? '')}`}>
          {t('admin.next')}
        </a>
      )}
    </section>
  );
}
