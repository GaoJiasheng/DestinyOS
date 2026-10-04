export const dynamic = 'force-dynamic';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { BirthForm } from '@/components/forms/birth-form';
import { getProfileAction } from '@/app/readings/actions';
import { auth } from '@/lib/auth';
/** Share the birth editor for profile creation and encrypted versioned updates. */
export default async function BirthPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if ((await cookies()).get('age_gate')?.value === 'blocked') redirect(`/${locale}/age-restricted`);
  const session = await auth();
  const current = session ? await getProfileAction() : null;
  return (
    <BirthForm
      profileMode
      signedIn={!!session}
      initial={current?.ok && current.data ? current.data : undefined}
    />
  );
}
