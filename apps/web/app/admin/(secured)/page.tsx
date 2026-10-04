import { requireAdmin } from '@/lib/admin-auth';
import { getAdminCopy } from '@/i18n/admin-copy';
import { stats } from '@/lib/admin-service';
import { Table } from '@/components/ui/table';
import { System } from '@tianji/shared';
/** Dashboard windows combine completed aggregates with current-day counters and cached Stripe metrics. */
export default async function Dashboard({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  await requireAdmin();
  const query = await searchParams;
  const range = query.range === '7' ? 7 : query.range === '30' ? 30 : 1;
  const data = await stats(range),
    t = await getAdminCopy();
  const days = new Map<string, number>();
  for (const row of data.rows)
    if (row.name === 'user.active')
      days.set(
        row.day.toISOString().slice(0, 10),
        (days.get(row.day.toISOString().slice(0, 10)) ?? 0) + row.uniques,
      );
  days.set(new Date().toISOString().slice(0, 10), data.dau);
  const created = data.counters['reading.created'] ?? 0,
    failed = data.counters['reading.failed'] ?? 0;
  return (
    <section>
      <h1>{t('admin.nav.dashboard')}</h1>
      <form>
        <label htmlFor="range">{t('admin.range')}</label>
        <select id="range" name="range" defaultValue={range}>
          <option value="1">{t('admin.range.today')}</option>
          <option value="7">{t('admin.range.week')}</option>
          <option value="30">{t('admin.range.month')}</option>
        </select>
        <button className="button button-secondary">{t('admin.apply')}</button>
      </form>
      {!data.liveAvailable && <p role="status">{t('admin.stats.cacheUnavailable')}</p>}
      <div className="admin-grid">
        {(
          [
            'user.registered',
            'reading.created',
            'daily.viewed',
            'share.created',
            'sub.started',
          ] as const
        ).map((name) => (
          <div className="admin-panel" key={name}>
            <h2>{t(`admin.event.${name}`)}</h2>
            <p>{t('admin.number', { value: data.counters[name] ?? 0 })}</p>
          </div>
        ))}
        <div className="admin-panel">
          <h2>{t('admin.stats.errors')}</h2>
          <p>
            {t('admin.percent', {
              value: created + failed ? (100 * failed) / (created + failed) : 0,
            })}
          </p>
          <a href="https://sentry.io/">{t('admin.stats.sentry')}</a>
        </div>
        <div className="admin-panel">
          <h2>{t('admin.stats.subscribers')}</h2>
          <p>
            {data.stripe.available
              ? t('admin.number', { value: data.stripe.subscribers })
              : t('admin.unavailable')}
          </p>
          <h3>{t('admin.stats.mrr')}</h3>
          {data.stripe.available ? (
            Object.entries(data.stripe.mrr).map(([currency, amount]) => (
              <p key={currency}>{t('admin.money', { currency: currency.toUpperCase(), amount })}</p>
            ))
          ) : (
            <p>{t('admin.unavailable')}</p>
          )}
        </div>
      </div>
      <Table>
        <caption>{t('admin.stats.dau')}</caption>
        <thead>
          <tr>
            <th scope="col">{t('admin.day')}</th>
            <th scope="col">{t('admin.stats.dau')}</th>
          </tr>
        </thead>
        <tbody>
          {[...days].sort().map(([day, count]) => (
            <tr key={day}>
              <td>{t('admin.content', { text: day })}</td>
              <td>{t('admin.number', { value: count })}</td>
            </tr>
          ))}
        </tbody>
      </Table>
      <Table>
        <caption>{t('admin.stats.bySystem')}</caption>
        <thead>
          <tr>
            <th scope="col">{t('admin.system')}</th>
            <th scope="col">{t('admin.event.reading.created')}</th>
          </tr>
        </thead>
        <tbody>
          {Object.values(System)
            .filter((s) => s !== 'daily')
            .map((system) => (
              <tr key={system}>
                <td>{t(`nav.${system}`)}</td>
                <td>
                  {t('admin.number', {
                    value:
                      data.rows
                        .filter((r) => r.name === 'reading.created' && r.system === system)
                        .reduce((n, r) => n + r.count, 0) +
                      (data.currentBySystem.find((r) => r.system === system)?._count ?? 0),
                  })}
                </td>
              </tr>
            ))}
        </tbody>
      </Table>
    </section>
  );
}
