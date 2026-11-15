import { getCopy } from '@/i18n/get-copy';
import { LogoutButton } from '@/components/auth/logout-button';
/** Sign-out that still works before hydration (native form post) and reloads the shell afterwards. */
export async function LogoutForm({ locale }: { locale: string }) {
  const t = await getCopy();
  return (
    <LogoutButton
      locale={locale}
      label={t('auth.login.signOut')}
      variant="secondary"
      className="me-logout"
    />
  );
}
