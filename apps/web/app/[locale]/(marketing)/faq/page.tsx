import { setRequestLocale } from 'next-intl/server';
import { getCopy } from '@/i18n/get-copy';
import { Link } from '@/i18n/navigation';
import { learnContent, structuredJson } from '@/lib/learn';
import { publicMetadata } from '@/lib/learn-metadata';
import { brand } from '@tianji/shared';
type Params = { locale: 'zh' | 'en' | 'zh-TW' };
// DESIGN-GAP: The task specifies a standalone FAQ without a route; use the conventional /faq public destination.
export const revalidate = 86400;
/** The FAQ canonical follows the same language-specific public route registry. */
export async function generateMetadata({ params }: { params: Promise<Params> }) {
  const { locale } = await params;
  const t = await getCopy(locale);
  return publicMetadata(t('learn.faq'), t('learn.faqIntro'), '/faq', locale);
}
/** Twenty visible questions, with matching FAQPage data and related policy links. */
export default async function FaqPage({ params }: { params: Promise<Params> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getCopy();
  const faq = (await learnContent(locale)).editorial.faq;
  const language = locale === 'en' ? 'en' : 'zh';
  return (
    <article className="learn-page">
      <h1 className="type-h1">{t('learn.faq')}</h1>
      <p>{t('learn.faqIntro')}</p>
      <div className="report-card" data-public-faq>
        {faq.map((item, index) => (
          <details key={index} id={`question-${index + 1}`}>
            <summary>{t('report.content', { text: item.question[language] })}</summary>
            <p>{t('report.content', { text: item.answer[language] })}</p>
          </details>
        ))}
      </div>
      <nav className="report-card" aria-label={t('learn.related')}>
        <ul>
          {(['learn', 'privacy', 'about', 'contact', 'pricing'] as const).map((path) => (
            <li key={path}>
              <Link href={`/${path}`}>
                {t(
                  path === 'learn'
                    ? 'nav.learn'
                    : path === 'pricing'
                      ? 'billing.title'
                      : `legal.${path}`,
                )}
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
            '@type': 'FAQPage',
            inLanguage: locale,
            url: `https://${brand.domain}/${locale}/faq`,
            mainEntity: faq.map((item) => ({
              '@type': 'Question',
              name: item.question[language],
              acceptedAnswer: { '@type': 'Answer', text: item.answer[language] },
            })),
          }),
        }}
      />
    </article>
  );
}
