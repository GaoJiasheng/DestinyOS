import { SystemArt } from '@/components/art/system-art';
import { isArtSystem } from '@tianji/ui-core/art';
import { AdSlot } from '@/components/ads/ad-slot';
import { Link } from '@/i18n/navigation';
import { getCopy } from '@/i18n/get-copy';
import { structuredJson } from '@/lib/learn';
import { brand } from '@tianji/shared';
/** Public article shell with bilingual structured data and a learning disclaimer. */
export async function LearnArticle({
  title,
  description,
  descriptionLang,
  path,
  locale,
  children,
}: {
  title: string;
  description: string;
  descriptionLang?: string;
  path: string;
  locale: 'zh' | 'en' | 'zh-TW';
  children: React.ReactNode;
}) {
  const t = await getCopy();
  const system = path.split('/')[2] ?? '';
  return (
    <article className="learn-page">
      {isArtSystem(system) ? <SystemArt system={system} banner priority /> : null}
      <Link href="/learn">{t('learn.title')}</Link>
      <h1 className="type-h1">{t('report.content', { text: title })}</h1>
      <p lang={descriptionLang}>{t('report.content', { text: description })}</p>
      {children}
      <AdSlot slot="learn" />
      <p>{t('report.disclaimer.short')}</p>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: structuredJson({
            '@context': 'https://schema.org',
            '@type': 'Article',
            headline: title,
            description,
            descriptionLang,
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
