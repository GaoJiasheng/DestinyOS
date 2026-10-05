import { fromDbLocale } from '@/lib/db-locale';
import { requireAdmin } from '@/lib/admin-auth';
import { listUsers } from '@/lib/admin-service';
import { getAdminCopy } from '@/i18n/admin-copy';
import { Table } from '@/components/ui/table';
/** Paginated, safe user list with email/ID search. */
export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; page?: string }>;
}) {
  await requireAdmin();
  const query = await searchParams,
    search = (query.search ?? '').slice(0, 160),
    page = Math.max(1, Math.min(10000, Number(query.page) || 1));
  const rows = await listUsers(search, Math.floor(page)),
    t = await getAdminCopy();
  return (
    <section>
      <h1>{t('admin.nav.users')}</h1>
      <form>
        <label htmlFor="search">{t('admin.users.search')}</label>
        <input id="search" name="search" defaultValue={search} maxLength={160} />
        <button className="button button-secondary">{t('admin.search')}</button>
      </form>
      <Table>
        <caption>{t('admin.nav.users')}</caption>
        <thead>
          <tr>
            {(
              [
                'email',
                'plan',
                'locale',
                'createdAt',
                'lastActiveAt',
                'readings',
                'status',
              ] as const
            ).map((key) => (
              <th scope="col" key={key}>
                {t(`admin.users.${key}`)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.slice(0, 50).map((user) => (
            <tr key={user.id}>
              <td>
                <a href={`/admin/users/${user.id}`}>
                  {t('admin.content', { text: user.email ?? user.id })}
                </a>
              </td>
              <td>{t(`me.plan.${user.plan}`)}</td>
              <td>{t(`me.language.${fromDbLocale(user.locale)}`)}</td>
              <td>{t('admin.content', { text: user.createdAt.toISOString().slice(0, 10) })}</td>
              <td>
                {user.lastActiveAt
                  ? t('admin.content', { text: user.lastActiveAt.toISOString() })
                  : t('admin.empty')}
              </td>
              <td>{t('admin.number', { value: user._count.readings })}</td>
              <td>{t(user.deletedAt ? 'admin.users.deleted' : 'admin.users.active')}</td>
            </tr>
          ))}
        </tbody>
      </Table>
      {!rows.length && <p>{t('admin.empty')}</p>}
      {page > 1 && (
        <a href={`?page=${page - 1}&search=${encodeURIComponent(search)}`}>{t('admin.previous')}</a>
      )}{' '}
      {rows.length > 50 && (
        <a href={`?page=${page + 1}&search=${encodeURIComponent(search)}`}>{t('admin.next')}</a>
      )}
    </section>
  );
}
