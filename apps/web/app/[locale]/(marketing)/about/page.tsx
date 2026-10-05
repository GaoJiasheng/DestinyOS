import { setRequestLocale } from 'next-intl/server';
import { getCopy } from '@/i18n/get-copy';
import { Link } from '@/i18n/navigation';
import { learnContent, structuredJson } from '@/lib/learn';
import { publicMetadata } from '@/lib/learn-metadata';
import { brand } from '@tianji/shared';
type Params = { locale: 'zh' | 'en' | 'zh-TW' };
export const revalidate = 86400;
/** Formal public About copy and three-language social metadata. */
export async function generateMetadata({ params }: { params: Promise<Params> }) {
  const { locale } = await params;
  const data = (await learnContent(locale)).editorial.about[locale === 'en' ? 'en' : 'zh'];
  return publicMetadata(data.title, data.description, '/about', locale);
}
/** Disclose the production method and explicit team/contact placeholders without invented credentials. */
export default async function AboutPage({ params }: { params: Promise<Params> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getCopy();
  const data = (await learnContent(locale)).editorial.about[locale === 'en' ? 'en' : 'zh'];
  return (
    <article className="learn-page">
      <h1 className="type-h1">{t('legal.about')}</h1>
      <p>{t('report.content', { text: data.description })}</p>
      {data.sections.map((section, index) => (
        <section className="report-card" key={index}>
          <h2>{t('report.content', { text: section.heading })}</h2>
          {section.paragraphs.map((text, n) => (
            <p key={n}>{t('report.content', { text })}</p>
          ))}
        </section>
      ))}
      <nav aria-label={t('learn.related')}>
        <ul>
          {(['contact', 'privacy', 'faq', 'learn'] as const).map((path) => (
            <li key={path}>
              <Link href={`/${path}`}>
                {t(path === 'learn' ? 'nav.learn' : path === 'faq' ? 'learn.faq' : `legal.${path}`)}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      <p>{t('report.disclaimer.short')}</p>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: structuredJson({
            '@context': 'https://schema.org',
            '@type': 'AboutPage',
            name: data.title,
            description: data.description,
            inLanguage: locale,
            url: `https://${brand.domain}/${locale}/about`,
            about: {
              '@type': 'Organization',
              name: brand.nameEn,
              alternateName: brand.nameZh,
              url: `https://${brand.domain}`,
            },
          }),
        }}
      />
    </article>
  );
}
