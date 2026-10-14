import { Suspense } from 'react';
import { setRequestLocale } from 'next-intl/server';
import { TarotMessages } from '@/components/tarot/tarot-messages';
import { TodayClient } from '@/components/daily/today-client';
import { RouteSkeleton } from '@/components/ui/route-skeleton';
export const revalidate = 3600;
export const metadata = { robots: { index: false, follow: false } };
/** A public shell contains no account data; the owner context loads after client navigation. */
export default async function TodayPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <TarotMessages daily>
      <Suspense fallback={<RouteSkeleton kind="daily" />}>
        <TodayClient />
      </Suspense>
    </TarotMessages>
  );
}
