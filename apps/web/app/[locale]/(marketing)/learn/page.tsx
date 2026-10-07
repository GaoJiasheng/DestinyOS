import { setRequestLocale } from 'next-intl/server';
import { getCopy } from '@/i18n/get-copy';
import { Link } from '@/i18n/navigation';
import { learnContent } from '@/lib/learn';
import { learnMetadata } from '@/lib/learn-metadata';
import { SystemArt } from '@/components/art/system-art';
import { isArtSystem } from '@tianji/ui-core/art';
export const revalidate = 86400;
/** Index metadata contains article-specific hreflang. */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: 'zh' | 'en' | 'zh-TW' }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getCopy();
  return learnMetadata(t('learn.title'), t('learn.intro'), '/learn', locale);
}
/** Link all nine system guides, 78 cards, 64 hexagrams and every glossary entry from public content. */
export default async function LearnPage({
  params,
}: {
  params: Promise<{ locale: 'zh' | 'en' | 'zh-TW' }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getCopy(),
    content = await learnContent(locale);
  return (
    <article className="learn-page">
      <h1 className="type-h1">{t('learn.title')}</h1>
      <p>{t('learn.intro')}</p>
      <p>
        <Link href="/faq">{t('learn.faq')}</Link>
      </p>
      <section className="report-card">
        <h2>{t('learn.systems')}</h2>
        <ul className="learn-grid">
          {content.systems.map((s) => (
            <li key={s.key}>
              <Link href={`/learn/${s.key}`} className="learn-system-link">
                {isArtSystem(s.key) ? <SystemArt system={s.key} /> : null}
                {t('report.content', { text: s[locale === 'en' ? 'en' : 'zh'].title })}
              </Link>
            </li>
          ))}
        </ul>
      </section>
      <section className="report-card">
        <h2>{t('learn.cards')}</h2>
        <ul className="learn-grid">
          {content.cards.map((c) => (
            <li key={c.key}>
              <Link href={`/learn/tarot/${c.key}`}>
                {t('report.content', { text: c.name[locale === 'en' ? 'en' : 'zh'] })}
              </Link>
            </li>
          ))}
        </ul>
      </section>
      <section className="report-card">
        <h2>{t('learn.hexagrams')}</h2>
        <ul className="learn-grid">
          {content.hexagrams.map((h) => (
            <li key={h.key}>
              <Link href={`/learn/iching/${h.key}`}>
                {h.number} ·{' '}
                {t('report.content', { text: locale !== 'en' ? h.name : h.englishName })}
              </Link>
            </li>
          ))}
        </ul>
      </section>
      <section className="report-card">
        <h2>{t('learn.glossary')}</h2>
        <Link href="/learn/glossary">{t('learn.glossaryIntro')}</Link>
      </section>
    </article>
  );
}
