import { getAdminCopy } from '@/i18n/admin-copy';
import { AdminActionForm } from '@/components/admin/action-form';
import { requireAdmin } from '@/lib/admin-auth';
import { reauthEmailAction, reauthGoogleAction } from '../actions';
/** Re-authenticate through an actual provider, never by extending the current session timestamp. */
export default async function ReauthPage() {
  await requireAdmin(false);
  const t = await getAdminCopy();
  return (
    <section>
      <h1>{t('admin.reauth.title')}</h1>
      <p>{t('admin.reauth.description')}</p>
      <AdminActionForm action={reauthEmailAction} label={t('admin.reauth.email')} />
      <form action={reauthGoogleAction}>
        <button className="button button-secondary">{t('auth.login.google')}</button>
      </form>
    </section>
  );
}
