import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { getCopy } from '@/i18n/get-copy';
import { Link } from '@/i18n/navigation';
import { learnContent } from '@/lib/learn';
import { learnMetadata } from '@/lib/learn-metadata';
import { LearnArticle } from '@/components/learn/learn-article';

type Params = { locale: 'zh' | 'en' | 'zh-TW'; system: string; slug: string };
export const revalidate = 86400;
export const dynamicParams = false;
/** Pre-render only the three tutorials belonging to the inherited system. */
export async function generateStaticParams({ params }: { params: { system?: string } }) {
  return (await learnContent()).articles
    .filter((article) => !params.system || article.system === params.system)
    .map((article) => ({ system: article.system, slug: article.slug }));
}
async function tutorial(params: Params) {
  const article = (await learnContent(params.locale)).articles.find(
    (entry) => entry.system === params.system && entry.slug === params.slug,
  );
  if (!article) notFound();
  return article;
}
/** Canonical, three-language alternates, and a topic-specific social card. */
export async function generateMetadata({ params }: { params: Promise<Params> }) {
  const p = await params;
  const article = await tutorial(p);
  const data = article[p.locale === 'en' ? 'en' : 'zh'];
  return learnMetadata(
    data.title,
    data.description,
    `/learn/${p.system}/articles/${p.slug}`,
    p.locale,
  );
}
/** Public long-form lessons are compiled offline, with conditional examples clearly labeled. */
export default async function TutorialPage({ params }: { params: Promise<Params> }) {
  const p = await params;
  setRequestLocale(p.locale);
  const article = await tutorial(p);
  const data = article[p.locale === 'en' ? 'en' : 'zh'];
  const t = await getCopy();
  return (
    <LearnArticle
      title={data.title}
      description={data.description}
      path={`/learn/${p.system}/articles/${p.slug}`}
      locale={p.locale}
    >
      <nav className="report-card" aria-label={t('learn.contents')}>
        <h2>{t('learn.contents')}</h2>
        <ol>
          {data.sections.map((section, index) => (
            <li key={index}>
              <a href={`#section-${index + 1}`}>{t('report.content', { text: section.heading })}</a>
            </li>
          ))}
        </ol>
      </nav>
      <div data-tutorial-body>
        {data.sections.map((section, index) => (
          <section className="report-card tutorial-section" id={`section-${index + 1}`} key={index}>
            <h2>{t('report.content', { text: section.heading })}</h2>
            {section.paragraphs.map((text, n) => (
              <p key={n}>{t('report.content', { text })}</p>
            ))}
          </section>
        ))}
      </div>
      <nav className="report-card" aria-label={t('learn.related')}>
        <h2>{t('learn.related')}</h2>
        <ul>
          {article.links.map((link) => (
            <li key={link.href}>
              <Link href={link.href}>
                {t('report.content', { text: link.label[p.locale === 'en' ? 'en' : 'zh'] })}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </LearnArticle>
  );
}
