import { Suspense } from 'react';
import { setRequestLocale } from 'next-intl/server';
import { TarotMessages } from '@/components/tarot/tarot-messages';
import { TodayClient } from '@/components/daily/today-client';
import { RouteSkeleton } from '@/components/ui/route-skeleton';
import { privatePageMetadata } from '@/lib/page-metadata';
export const revalidate = 3600;
export const generateMetadata = ({ params }: { params: Promise<{ locale: string }> }) =>
  privatePageMetadata(params, 'seo.page.today');
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
