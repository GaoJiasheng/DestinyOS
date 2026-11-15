import { fromDbLocale } from '@/lib/db-locale';
import { auth } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { SettingsForm } from '@/components/me/settings-form';
import { webPushAvailable } from '@/lib/web-push-flag';
import { LogoutForm } from '@/components/me/logout-form';
import webPackage from '@/package.json';
import { privatePageMetadata } from '@/lib/page-metadata';
export const dynamic = 'force-dynamic';
export const generateMetadata = ({ params }: { params: Promise<{ locale: string }> }) =>
  privatePageMetadata(params, 'seo.page.meSettings');
/** A build-time version when one is injected; the workspace placeholder 0.0.0 is never shown. */
function buildVersion(): string | null {
  const injected = process.env.NEXT_PUBLIC_BUILD_VERSION?.trim();
  if (injected) return injected;
  return webPackage.version && webPackage.version !== '0.0.0' ? webPackage.version : null;
}
/** Settings are owner-only on the server and device-only for anonymous visitors. */
export default async function SettingsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
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
      pushAvailable={webPushAvailable()}
      version={buildVersion()}
      logout={session?.user.id ? <LogoutForm locale={locale} /> : null}
    />
  );
}
