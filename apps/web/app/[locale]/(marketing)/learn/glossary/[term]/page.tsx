import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { getCopy } from '@/i18n/get-copy';
import { learnContent } from '@/lib/learn';
import { learnMetadata } from '@/lib/learn-metadata';
import { LearnArticle } from '@/components/learn/learn-article';
export const revalidate = 86400;
/** Generate every glossary term, retaining its exact content key in the URL. */
export async function generateStaticParams() {
  return (await learnContent()).glossary.map((g) => ({ term: g.key }));
}
/** Glossary canonical, description and locale alternates. */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: 'zh' | 'en'; term: string }>;
}) {
  const { locale, term } = await params,
    g = (await learnContent()).glossary.find((g) => g.key === term);
  if (!g) notFound();
  return learnMetadata(g[locale].term, g[locale].short, `/learn/glossary/${term}`, locale);
}
/** Render the full source glossary entry as a publicly indexable article. */
export default async function GlossaryPage({
  params,
}: {
  params: Promise<{ locale: 'zh' | 'en'; term: string }>;
}) {
  const { locale, term } = await params;
  setRequestLocale(locale);
  const g = (await learnContent()).glossary.find((g) => g.key === term);
  if (!g) notFound();
  const t = await getCopy();
  return (
    <LearnArticle
      title={g[locale].term}
      description={g[locale].short}
      path={`/learn/glossary/${term}`}
      locale={locale}
    >
      <section className="report-card">
        {g[locale].pinyin ? <p>{t('report.content', { text: g[locale].pinyin! })}</p> : null}
        <p>{t('report.content', { text: g[locale].long })}</p>
      </section>
    </LearnArticle>
  );
}
