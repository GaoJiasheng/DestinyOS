import { SystemArt } from '@/components/art/system-art';
import { setRequestLocale } from 'next-intl/server';
import { DeferredQimen } from '@/components/forms/deferred-qimen';
import { publicRouteMetadata } from '@/lib/public-seo';
export const revalidate = 3600;
/** Birth-independent public landing; private state and casting dependencies load after hydration. */
export default async function QimenPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <>
      <SystemArt system="qimen" banner priority />
      <DeferredQimen />
    </>
  );
}
/** Preserve canonical language alternates for the documented system route. */
export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  return publicRouteMetadata(params, '/qimen');
}
