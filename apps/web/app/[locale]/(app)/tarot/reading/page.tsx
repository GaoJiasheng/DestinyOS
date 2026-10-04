import { setRequestLocale } from 'next-intl/server';
import { TarotMessages } from '@/components/tarot/tarot-messages';
import { TarotRitual } from '@/components/tarot/tarot-ritual';
import { loadKnowledge } from '@/lib/knowledge';
import { auth } from '@/lib/auth';
import { ENGINE_VERSION } from '@tianji/engine';
export const dynamic = 'force-dynamic';
export const metadata = { robots: { index: false, follow: false } };
/** Preload the bilingual knowledge bundle so the entire anonymous ritual works without later network requests. */
export default async function TarotReadingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const [knowledge, session] = await Promise.all([loadKnowledge('tarot', 'zh'), auth()]);
  return (
    <TarotMessages>
      <TarotRitual
        knowledge={knowledge}
        engineVersion={ENGINE_VERSION}
        signedIn={Boolean(session?.user?.id)}
      />
    </TarotMessages>
  );
}
