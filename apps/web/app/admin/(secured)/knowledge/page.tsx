import { requireAdmin } from '@/lib/admin-auth';
import { listKu } from '@/lib/admin-knowledge';
import { getAdminCopy } from '@/i18n/admin-copy';
import { Table } from '@/components/ui/table';
import { System } from '@tianji/shared';
/** Browse and filter the latest KU revisions and shipped corpus without hiding published content. */
export default async function KnowledgePage({
  searchParams,
}: {
  searchParams: Promise<{
    system?: string;
    section?: string;
    status?: string;
    search?: string;
    page?: string;
  }>;
}) {
  await requireAdmin();
  const query = await searchParams,
    units = await listKu(),
    t = await getAdminCopy();
  const page = Math.max(1, Math.floor(Number(query.page) || 1));
  const matches = units.filter(
    (u) =>
      (!query.system || u.system === query.system) &&
      (!query.section || u.section === query.section) &&
      (!query.status || u.meta.status === query.status) &&
      (!query.search ||
        `${u.id} ${u.zh.title} ${u.en.title}`.toLowerCase().includes(query.search.toLowerCase())),
  );
  return (
    <section>
      <h1>{t('admin.nav.knowledge')}</h1>
      <form className="admin-grid">
        <div>
          <label htmlFor="system">{t('admin.system')}</label>
          <select name="system" id="system" defaultValue={query.system ?? ''}>
            <option value="">{t('admin.all')}</option>
            {Object.values(System).map((system) => (
              <option key={system} value={system}>
                {system === 'daily' ? t('admin.event.daily.viewed') : t(`nav.${system}`)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="section">{t('admin.section')}</label>
          <select name="section" id="section" defaultValue={query.section ?? ''}>
            <option value="">{t('admin.all')}</option>
            {[...new Set(units.map((u) => u.section))].sort().map((section) => (
              <option key={section}>{t('admin.content', { text: section })}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="status">{t('admin.users.status')}</label>
          <select name="status" id="status" defaultValue={query.status ?? ''}>
            <option value="">{t('admin.all')}</option>
            {(['draft', 'published', 'deprecated'] as const).map((status) => (
              <option key={status} value={status}>
                {t(`admin.ku.${status}`)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="search">{t('admin.ku.search')}</label>
          <input id="search" name="search" maxLength={160} defaultValue={query.search ?? ''} />
        </div>
        <button className="button button-secondary">{t('admin.search')}</button>
      </form>
      <Table>
        <caption>{t('admin.ku.count', { count: matches.length })}</caption>
        <thead>
          <tr>
            <th scope="col">{t('admin.ku.unitId')}</th>
            <th scope="col">{t('admin.ku.title')}</th>
            <th scope="col">{t('admin.users.status')}</th>
            <th scope="col">{t('admin.profile.version')}</th>
          </tr>
        </thead>
        <tbody>
          {matches.slice((page - 1) * 50, page * 50).map((unit) => (
            <tr key={unit.id}>
              <td>
                <a href={`/admin/knowledge/${unit.id}`}>{t('admin.content', { text: unit.id })}</a>
              </td>
              <td>
                {t('admin.content', { text: unit.zh.title })}
                <br />
                {t('admin.content', { text: unit.en.title })}
              </td>
              <td>{t(`admin.ku.${unit.meta.status}`)}</td>
              <td>{t('admin.number', { value: unit.meta.version })}</td>
            </tr>
          ))}
        </tbody>
      </Table>
      {!matches.length && <p>{t('admin.empty')}</p>}
      {page > 1 && (
        <a href={`?${new URLSearchParams({ ...query, page: String(page - 1) })}`}>
          {t('admin.previous')}
        </a>
      )}{' '}
      {matches.length > page * 50 && (
        <a href={`?${new URLSearchParams({ ...query, page: String(page + 1) })}`}>
          {t('admin.next')}
        </a>
      )}
    </section>
  );
}
