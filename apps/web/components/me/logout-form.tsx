import { getCopy } from '@/i18n/get-copy';
import { Button } from '@/components/ui/button';
import { logoutAction } from '@/app/[locale]/auth/actions';
/** Server-rendered sign-out; works before hydration because it is a plain form post to the Server Action. */
export async function LogoutForm({ locale }: { locale: string }) {
  const t = await getCopy();
  return (
    <form action={logoutAction.bind(null, locale)} className="me-logout">
      <Button variant="secondary" type="submit">
        {t('auth.login.signOut')}
      </Button>
    </form>
  );
}
