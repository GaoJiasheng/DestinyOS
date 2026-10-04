import { Link } from '@/i18n/navigation';
import { getCopy } from '@/i18n/get-copy';
import { structuredJson } from '@/lib/learn';
import { brand } from '@tianji/shared';
/** Public article shell with bilingual structured data and a learning disclaimer. */
export async function LearnArticle({
  title,
  description,
  path,
  locale,
  children,
}: {
  title: string;
  description: string;
  path: string;
  locale: 'zh' | 'en';
  children: React.ReactNode;
}) {
  const t = await getCopy();
  return (
    <article className="learn-page">
      <Link href="/learn">{t('learn.title')}</Link>
      <h1 className="type-h1">{t('report.content', { text: title })}</h1>
      <p>{t('report.content', { text: description })}</p>
      {children}
      <p>{t('report.disclaimer.short')}</p>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: structuredJson({
            '@context': 'https://schema.org',
            '@type': 'Article',
            headline: title,
            description,
            inLanguage: locale,
            mainEntityOfPage: `https://${brand.domain}/${locale}${path}`,
            author: { '@type': 'Organization', name: brand.nameEn },
            publisher: { '@type': 'Organization', name: brand.nameEn },
          }),
        }}
      />
    </article>
  );
}
