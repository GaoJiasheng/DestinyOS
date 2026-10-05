export const dynamic = 'force-dynamic';
import { notFound, redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { setRequestLocale } from 'next-intl/server';
import { System } from '@tianji/shared';
import { NumerologyForm } from '@/components/forms/numerology-form';
import { BirthForm } from '@/components/forms/birth-form';
import { auth } from '@/lib/auth';
import { getProfileAction } from '@/app/readings/actions';
export const metadata = { robots: { index: false, follow: false } };
/** Show the shared birth form with the owner's current encrypted profile when available. */
export default async function NewReading({
  params,
}: {
  params: Promise<{ locale: string; system: string }>;
}) {
  const { locale, system } = await params;
  setRequestLocale(locale);
  if (!Object.values(System).includes(system as System) || system === 'daily') notFound();
  if ((await cookies()).get('age_gate')?.value === 'blocked') redirect(`/${locale}/age-restricted`);
  if (system === 'synastry') redirect(`/${locale}/synastry`);
  if (system === 'iching' || system === 'qimen') redirect(`/${locale}/${system}`);
  const session = await auth();
  const profile = session ? await getProfileAction() : null;
  if (system === 'numerology')
    return (
      <NumerologyForm
        key={
          profile?.ok && profile.data
            ? `${profile.data.profileId}:${profile.data.version}`
            : 'anonymous'
        }
        signedIn={!!session}
        initial={profile?.ok && profile.data ? profile.data : undefined}
      />
    );
  return (
    <BirthForm
      key={
        profile?.ok && profile.data
          ? `${profile.data.profileId}:${profile.data.version}`
          : 'anonymous'
      }
      system={system as Exclude<System, 'daily'>}
      signedIn={!!session}
      initial={profile?.ok && profile.data ? profile.data : undefined}
    />
  );
}
