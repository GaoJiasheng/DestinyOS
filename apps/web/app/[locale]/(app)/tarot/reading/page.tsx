import { setRequestLocale } from 'next-intl/server';
import { TarotMessages } from '@/components/tarot/tarot-messages';
import { TarotRitual } from '@/components/tarot/tarot-ritual';
import { loadKnowledge } from '@/lib/knowledge';
import { auth } from '@/lib/auth';
import { ENGINE_VERSION } from '@tianji/engine/version';
import { parseTarotEntry } from '@/components/tarot/ritual-state';
import { privatePageMetadata } from '@/lib/page-metadata';
export const dynamic = 'force-dynamic';
export const generateMetadata = ({ params }: { params: Promise<{ locale: string }> }) =>
  privatePageMetadata(params, 'seo.page.tarotReading');
/** Preload the bilingual knowledge bundle so the entire anonymous ritual works without later network requests. */
export default async function TarotReadingPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ spread?: string | string[]; q?: string | string[] }>;
}) {
  const { locale } = await params;
  const { spread, q } = await searchParams;
  // Direct entry (`?spread=single&q=…`) skips the landing form; invalid spreads fall back to the stored draft.
  const entry = parseTarotEntry(spread, q);
  setRequestLocale(locale);
  const [knowledge, session] = await Promise.all([loadKnowledge('tarot', 'zh'), auth()]);
  return (
    <TarotMessages>
      <TarotRitual
        knowledge={knowledge}
        engineVersion={ENGINE_VERSION}
        signedIn={Boolean(session?.user?.id)}
        entry={entry}
      />
    </TarotMessages>
  );
}
