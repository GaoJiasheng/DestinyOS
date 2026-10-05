import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { getCopy } from '@/i18n/get-copy';
import { learnContent } from '@/lib/learn';
import { learnMetadata } from '@/lib/learn-metadata';
import { LearnArticle } from '@/components/learn/learn-article';
export const revalidate = 86400;
/** Pre-render all 64 King Wen hexagrams from the editorial source. */
export async function generateStaticParams() {
  return (await learnContent()).hexagrams.map((h) => ({ hexagram: h.key }));
}
/** Hexagram canonical and bilingual metadata. */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: 'zh' | 'en'; hexagram: string }>;
}) {
  const { locale, hexagram } = await params,
    h = (await learnContent()).hexagrams.find((h) => h.key === hexagram);
  if (!h) notFound();
  return learnMetadata(
    locale === 'zh' ? h.name : h.englishName,
    h.meaning[locale].slice(0, 160),
    `/learn/iching/${hexagram}`,
    locale,
  );
}
/** Original classical text is expandable; all six line meanings and question guidance are bilingual. */
export default async function HexagramLearnPage({
  params,
}: {
  params: Promise<{ locale: 'zh' | 'en'; hexagram: string }>;
}) {
  const { locale, hexagram } = await params;
  setRequestLocale(locale);
  const h = (await learnContent()).hexagrams.find((h) => h.key === hexagram);
  if (!h) notFound();
  const t = await getCopy();
  return (
    <LearnArticle
      title={locale === 'zh' ? h.name : h.englishName}
      description={h.pinyin}
      descriptionLang="zh-Latn"
      path={`/learn/iching/${hexagram}`}
      locale={locale}
    >
      <figure
        className="hexagram-figure"
        aria-label={t('learn.hexagramNumber', { number: h.number })}
      >
        <div className="hexagram-lines" aria-hidden>
          {h.lines.map((yang, i) => (
            <div className="hexagram-line" key={i}>
              <span className={yang ? 'yang-line' : 'yin-line'} />
            </div>
          ))}
        </div>
      </figure>
      <section className="report-card">
        <h2>{t('learn.meaning')}</h2>
        <p>{t('report.content', { text: h.meaning[locale] })}</p>
        <details>
          <summary>{t('learn.original')}</summary>
          {[h.judgment, h.tuan, h.image].map((text, i) => (
            <p lang="zh" key={i}>
              {t('report.content', { text })}
            </p>
          ))}
        </details>
      </section>
      <section className="report-card">
        <h2>{t('learn.lines')}</h2>
        {h.yao.map((y) => (
          <div key={y.position}>
            <h3>{t('learn.lineNumber', { number: y.position })}</h3>
            <details>
              <summary>{t('learn.original')}</summary>
              <p lang="zh">{t('report.content', { text: y.original })}</p>
            </details>
            <p>{t('report.content', { text: y.meaning[locale] })}</p>
          </div>
        ))}
      </section>
      <section className="report-card">
        <h2>{t('learn.questions')}</h2>
        {Object.entries(h.guidance).map(([key, text]) => (
          <details key={key}>
            <summary>{t(`learn.category.${key}` as import('@/i18n/catalog').MessageKey)}</summary>
            <p>{t('report.content', { text: text[locale] })}</p>
          </details>
        ))}
      </section>
    </LearnArticle>
  );
}
