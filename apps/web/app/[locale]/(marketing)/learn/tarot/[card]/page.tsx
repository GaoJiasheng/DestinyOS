import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { getCopy } from '@/i18n/get-copy';
import { Link } from '@/i18n/navigation';
import { learnContent } from '@/lib/learn';
import { learnMetadata } from '@/lib/learn-metadata';
import { LearnArticle } from '@/components/learn/learn-article';
export const revalidate = 86400;
/** Pre-render all 78 content cards. */
export async function generateStaticParams() {
  return (await learnContent()).cards.map((c) => ({ card: c.key }));
}
/** Card canonical, hreflang and article description. */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: 'zh' | 'en'; card: string }>;
}) {
  const { locale, card } = await params,
    c = (await learnContent()).cards.find((c) => c.key === card);
  if (!c) notFound();
  return learnMetadata(
    c.name[locale],
    c.keywordsUpright[locale].join(' · '),
    `/learn/tarot/${card}`,
    locale,
  );
}
/** Upright/reversed meanings, symbolism, related cards and the draw CTA. */
export default async function CardLearnPage({
  params,
}: {
  params: Promise<{ locale: 'zh' | 'en'; card: string }>;
}) {
  const { locale, card } = await params;
  setRequestLocale(locale);
  const content = await learnContent(),
    c = content.cards.find((c) => c.key === card);
  if (!c) notFound();
  const t = await getCopy();
  // DESIGN-GAP: Related-card edges are absent in the source; show three cards sharing the documented elemental correspondence.
  const related = content.cards
    .filter((r) => r.key !== c.key && r.element === c.element)
    .slice(0, 3);
  return (
    <LearnArticle
      title={c.name[locale]}
      description={c.keywordsUpright[locale].join(' · ')}
      path={`/learn/tarot/${card}`}
      locale={locale}
    >
      <img
        className="learn-card-image"
        width="240"
        height="420"
        src={`/tarot/rws/${c.key}.webp`}
        alt={t('report.content', { text: c.name[locale] })}
      />
      {(['meaningUpright', 'meaningReversed', 'imagery', 'advice'] as const).map((k) => (
        <section className="report-card" key={k}>
          <h2>{t(`learn.${k}`)}</h2>
          {k === 'meaningReversed' ? (
            <p>{t('report.content', { text: c.keywordsReversed[locale].join(' · ') })}</p>
          ) : null}
          <p>{t('report.content', { text: c[k][locale] })}</p>
        </section>
      ))}
      <section className="report-card">
        <h2>{t('learn.related')}</h2>
        {related.map((r) => (
          <p key={r.key}>
            <Link href={`/learn/tarot/${r.key}`}>
              {t('report.content', { text: r.name[locale] })}
            </Link>
          </p>
        ))}
      </section>
      <Link className="text-link" href="/tarot">
        {t('learn.drawCTA')}
      </Link>
    </LearnArticle>
  );
}
