import { notFound, redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { setRequestLocale } from 'next-intl/server';
import { DivinationFlow, type CastMethod } from '@/components/forms/divination-flow';
import { loadKnowledge } from '@/lib/knowledge';
import { auth } from '@/lib/auth';
import { clipQuestion } from '@/components/tarot/ritual-state';
import { privatePageMetadata } from '@/lib/page-metadata';
export const dynamic = 'force-dynamic';
export const generateMetadata = ({ params }: { params: Promise<{ locale: string }> }) =>
  privatePageMetadata(params, 'seo.page.ichingCast');
/** Load the locale's bundled knowledge before the ritual so anonymous computation survives network loss. */
export default async function CastPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ method?: string | string[]; q?: string | string[] }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  if (locale !== 'zh' && locale !== 'en' && locale !== 'zh-TW') notFound();
  const { method: rawMethod, q } = await searchParams;
  const method = typeof rawMethod === 'string' ? rawMethod : 'time';
  // DESIGN-GAP: cast?method uses the three castBy values plus liuyao; meihua defaults to its time method.
  const castMethod = method === 'meihua' ? 'time' : method;
  if (!['time', 'numbers', 'random', 'liuyao'].includes(castMethod)) notFound();
  if ((await cookies()).get('age_gate')?.value === 'blocked') redirect(`/${locale}/age-restricted`);
  return (
    <DivinationFlow
      system="iching"
      method={castMethod as CastMethod}
      // DESIGN-GAP: `q` prefills the question for direct entries (bottom "ask" sheet); the client strips it from the URL.
      initialQuestion={clipQuestion(q)}
      knowledge={await loadKnowledge('iching', locale)}
      signedIn={Boolean(await auth())}
    />
  );
}
