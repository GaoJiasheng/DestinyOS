import { Suspense } from 'react';
import { setRequestLocale } from 'next-intl/server';
import { preload } from 'react-dom';
import { TarotMessages } from '@/components/tarot/tarot-messages';
import { TodayClient } from '@/components/daily/today-client';
import { RouteSkeleton } from '@/components/ui/route-skeleton';
import workerAsset from '@/lib/daily-worker-asset.json';
export const revalidate = 3600;
export const metadata = { robots: { index: false, follow: false } };
/** A public shell contains no account data; the owner context loads after client navigation. */
export default async function TodayPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  preload(locale === 'zh-TW' ? workerAsset.traditionalUrl : workerAsset.url, {
    as: 'script',
    fetchPriority: 'low',
  });
  return (
    <TarotMessages daily>
      <Suspense fallback={<RouteSkeleton kind="daily" />}>
        <TodayClient />
      </Suspense>
    </TarotMessages>
  );
}
