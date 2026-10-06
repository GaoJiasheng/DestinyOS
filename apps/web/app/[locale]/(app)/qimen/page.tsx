import { SystemArt } from '@/components/art/system-art';
import { notFound, redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { setRequestLocale } from 'next-intl/server';
import { DivinationFlow } from '@/components/forms/divination-flow';
import { loadKnowledge } from '@/lib/knowledge';
import { auth } from '@/lib/auth';
export const dynamic = 'force-dynamic';
export const metadata = { robots: { index: false, follow: false } };
/** Birth-independent rotating/chaibu parameter page, with the user's current civil clock as default. */
export default async function QimenPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  if (locale !== 'zh' && locale !== 'en' && locale !== 'zh-TW') notFound();
  if ((await cookies()).get('age_gate')?.value === 'blocked') redirect(`/${locale}/age-restricted`);
  return (
    <>
      <SystemArt system="qimen" banner priority />
      <DivinationFlow
        system="qimen"
        knowledge={await loadKnowledge('qimen', locale)}
        signedIn={Boolean(await auth())}
      />
    </>
  );
}
