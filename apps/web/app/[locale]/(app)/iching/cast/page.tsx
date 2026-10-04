import { notFound, redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { setRequestLocale } from 'next-intl/server';
import { DivinationFlow, type CastMethod } from '@/components/forms/divination-flow';
import { loadKnowledge } from '@/lib/knowledge';
import { auth } from '@/lib/auth';
export const dynamic = 'force-dynamic';
export const metadata = { robots: { index: false, follow: false } };
/** Load the locale's bundled knowledge before the ritual so anonymous computation survives network loss. */
export default async function CastPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ method?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  if (locale !== 'zh' && locale !== 'en') notFound();
  const { method = 'time' } = await searchParams;
  // DESIGN-GAP: cast?method uses the three castBy values plus liuyao; meihua defaults to its time method.
  const castMethod = method === 'meihua' ? 'time' : method;
  if (!['time', 'numbers', 'random', 'liuyao'].includes(castMethod)) notFound();
  if ((await cookies()).get('age_gate')?.value === 'blocked') redirect(`/${locale}/age-restricted`);
  return (
    <DivinationFlow
      system="iching"
      method={castMethod as CastMethod}
      knowledge={await loadKnowledge('iching', locale)}
      signedIn={Boolean(await auth())}
    />
  );
}
