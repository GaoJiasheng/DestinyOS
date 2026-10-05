import { fromDbLocale } from '@/lib/db-locale';
import { auth } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { SettingsForm } from '@/components/me/settings-form';
export const dynamic = 'force-dynamic';
export const metadata = { robots: { index: false, follow: false } };
/** Settings are owner-only on the server and device-only for anonymous visitors. */
export default async function SettingsPage() {
  const session = await auth();
  const user = session?.user.id
    ? await getDb().user.findUnique({
        where: { id: session.user.id },
        select: {
          locale: true,
          theme: true,
          soundOn: true,
          reducedMotion: true,
          tz: true,
          name: true,
        },
      })
    : null;
  return (
    <SettingsForm
      initial={user ? { ...user, locale: fromDbLocale(user.locale) } : null}
      signedIn={Boolean(session?.user.id)}
    />
  );
}
