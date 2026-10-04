import { notFound } from 'next/navigation';
import { requireAdmin } from '@/lib/admin-auth';
import { getUser } from '@/lib/admin-service';
import { getAdminCopy } from '@/i18n/admin-copy';
import { AdminActionForm } from '@/components/admin/action-form';
import { setPlanAction, softDeleteUserAction, emailUserExportAction } from '../../../actions';
/** Privacy-safe details show only documented coarse profile fields and versions. */
export default async function UserPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const user = await getUser((await params).id).catch(() => notFound()),
    t = await getAdminCopy();
  return (
    <section>
      <h1>{t('admin.users.detail')}</h1>
      <p>{t('admin.content', { text: user.email ?? user.id })}</p>
      <p>{t('admin.users.profileVersions', { count: user._count.profiles })}</p>
      {user.profiles.map((profile) => (
        <dl className="admin-panel" key={profile.version}>
          {(['birthYear', 'tz', 'gender', 'timeUnknown', 'version'] as const).map((key) => (
            <div key={key}>
              <dt>{t(`admin.profile.${key}`)}</dt>
              <dd>
                {key === 'gender'
                  ? t(`form.birth.gender.${profile.gender}`)
                  : key === 'timeUnknown'
                    ? t(profile.timeUnknown ? 'admin.yes' : 'admin.no')
                    : t('admin.content', { text: String(profile[key]) })}
              </dd>
            </div>
          ))}
        </dl>
      ))}
      {user.deletedAt ? (
        <p>{t('admin.users.deleted')}</p>
      ) : (
        <>
          <AdminActionForm action={setPlanAction} label={t('admin.users.setPlan')}>
            <input type="hidden" name="id" value={user.id} />
            <label htmlFor="plan">{t('admin.users.plan')}</label>
            <select id="plan" name="plan" defaultValue={user.plan}>
              <option value="free">{t('me.plan.free')}</option>
              <option value="pro">{t('me.plan.pro')}</option>
            </select>
          </AdminActionForm>
          <AdminActionForm action={emailUserExportAction} label={t('admin.users.export')}>
            <input type="hidden" name="id" value={user.id} />
          </AdminActionForm>
          <AdminActionForm action={softDeleteUserAction} label={t('admin.users.delete')}>
            <input type="hidden" name="id" value={user.id} />
          </AdminActionForm>
        </>
      )}
    </section>
  );
}
