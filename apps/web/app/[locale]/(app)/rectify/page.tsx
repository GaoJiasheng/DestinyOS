import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { auth } from '@/lib/auth';
import { getProfileAction } from '@/app/readings/actions';
import { RectificationWizard } from '@/components/forms/rectification-wizard';
export const dynamic = 'force-dynamic';
export const metadata = { robots: { index: false, follow: false } };
/** Offer an optional birth-time trial while respecting the existing age gate and owner profile boundary. */
export default async function RectificationPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  if ((await cookies()).get('age_gate')?.value === 'blocked') redirect(`/${locale}/age-restricted`);
  const session = await auth();
  const profile = session ? await getProfileAction() : null;
  return (
    <RectificationWizard
      signedIn={!!session}
      initial={profile?.ok && profile.data ? profile.data : undefined}
    />
  );
}
