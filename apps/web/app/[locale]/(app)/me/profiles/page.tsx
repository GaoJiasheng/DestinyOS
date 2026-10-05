import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { listProfilesAction } from '@/app/profiles/actions';
import { ProfileManager } from '@/components/me/profile-manager';
import { getCopy } from '@/i18n/get-copy';
export const dynamic = 'force-dynamic';
export const metadata = { robots: { index: false, follow: false } };
/** Owner profile management is never publicly cached. */
export default async function ProfilesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!(await auth())?.user.id)
    redirect(`/${locale}/auth/login?callbackUrl=${encodeURIComponent(`/${locale}/me/profiles`)}`);
  const result = await listProfilesAction();
  if (!result.ok) return <p role="alert">{(await getCopy())('report.error.E_INTERNAL')}</p>;
  return <ProfileManager key={result.data.selectedId ?? 'empty'} initial={result.data} />;
}
