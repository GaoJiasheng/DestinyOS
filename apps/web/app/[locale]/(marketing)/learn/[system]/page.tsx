import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { getCopy } from '@/i18n/get-copy';
import { Link } from '@/i18n/navigation';
import { learnContent } from '@/lib/learn';
import { learnMetadata } from '@/lib/learn-metadata';
import { LearnArticle } from '@/components/learn/learn-article';
// DESIGN-GAP: Permit published locale entries to recover from ISR cache misses; middleware rejects unknown learning URLs before streaming.
export const dynamicParams = true;
export const revalidate = 86400;
/** Build every documented system introduction in both inherited locale routes. */
export async function generateStaticParams() {
  return (await learnContent()).systems.map((s) => ({ system: s.key }));
}
/** Localized introduction metadata. */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: 'zh' | 'en' | 'zh-TW'; system: string }>;
}) {
  const { locale, system } = await params,
    s = (await learnContent(locale)).systems.find((s) => s.key === system);
  if (!s) notFound();
  return learnMetadata(
    s[locale === 'en' ? 'en' : 'zh'].title,
    s[locale === 'en' ? 'en' : 'zh'].principle,
    `/learn/${system}`,
    locale,
  );
}
/** History, principle, questions, glossary and school FAQ from the content artifact. */
export default async function SystemLearnPage({
  params,
}: {
  params: Promise<{ locale: 'zh' | 'en' | 'zh-TW'; system: string }>;
}) {
  const { locale, system } = await params;
  setRequestLocale(locale);
  const content = await learnContent(locale),
    s = content.systems.find((s) => s.key === system);
  if (!s) notFound();
  const t = await getCopy(),
    data = s[locale === 'en' ? 'en' : 'zh'];
  return (
    <LearnArticle
      title={data.title}
      description={data.principle}
      path={`/learn/${system}`}
      locale={locale}
    >
      <section className="report-card">
        <h2>{t('learn.tutorials')}</h2>
        <ul>
          {content.articles
            .filter((article) => article.system === system)
            .map((article) => (
              <li key={article.slug}>
                <Link href={`/learn/${system}/articles/${article.slug}`}>
                  {t('report.content', { text: article[locale === 'en' ? 'en' : 'zh'].title })}
                </Link>
              </li>
            ))}
        </ul>
      </section>
      {(['history', 'principle', 'questions', 'school'] as const).map((k) => (
        <section className="report-card" key={k}>
          <h2>{t(`learn.${k}`)}</h2>
          <p>{t('report.content', { text: data[k] })}</p>
        </section>
      ))}
      <section className="report-card">
        <h2>{t('learn.glossary')}</h2>
        <ul>
          {content.glossary
            .filter((g) => g.system === system)
            .slice(0, 12)
            .map((g) => (
              <li key={g.key}>
                <Link href={`/learn/glossary/${g.key}`}>
                  {t('report.content', { text: g[locale === 'en' ? 'en' : 'zh'].term })}
                </Link>
              </li>
            ))}
        </ul>
      </section>
      <section className="report-card">
        <h2>{t('learn.faq')}</h2>
        {data.faq.map((f, i) => (
          <details key={i}>
            <summary>{t('report.content', { text: f.question })}</summary>
            <p>{t('report.content', { text: f.answer })}</p>
          </details>
        ))}
      </section>
      <Link className="text-link" href={`/${system}`}>
        {t('learn.start')}
      </Link>
      <p>
        <Link href="/faq">{t('learn.faq')}</Link>
      </p>
    </LearnArticle>
  );
}
