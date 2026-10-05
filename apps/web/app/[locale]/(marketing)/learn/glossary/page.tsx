import { setRequestLocale } from 'next-intl/server';
import { getCopy } from '@/i18n/get-copy';
import { GlossaryNavigation } from '@/components/learn/glossary-navigation';
import { LearnArticle } from '@/components/learn/learn-article';
import { learnMetadata } from '@/lib/learn-metadata';
type Params = { locale: 'zh' | 'en' | 'zh-TW' };
export const revalidate = 86400;
/** Localized terminology index metadata. */
export async function generateMetadata({ params }: { params: Promise<Params> }) {
  const { locale } = await params;
  const t = await getCopy(locale);
  return learnMetadata(t('learn.glossary'), t('learn.glossaryIntro'), '/learn/glossary', locale);
}
/** A complete glossary with system anchors and links to full definitions. */
export default async function GlossaryIndex({ params }: { params: Promise<Params> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getCopy();
  return (
    <LearnArticle
      title={t('learn.glossary')}
      description={t('learn.glossaryIntro')}
      path="/learn/glossary"
      locale={locale}
    >
      <GlossaryNavigation locale={locale} />
    </LearnArticle>
  );
}
