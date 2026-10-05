import { isLocale } from '@/i18n/routing';
import { ShareDiagram } from '@/components/share/share-diagram';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { publicShare } from '@/lib/share-service';
import { runtimeKey } from '@/i18n/runtime-key';
import { shareCopy } from '@/lib/share-copy';
import { brand } from '@tianji/shared';
export const dynamic = 'force-dynamic';
/** Birth-free noindex metadata uses the same authorized projection as the page and image. */
export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ locale?: string }>;
}): Promise<Metadata> {
  const { token } = await params,
    { locale } = await searchParams;
  try {
    const share = await publicShare(token, locale && isLocale(locale) ? locale : undefined);
    return {
      title: share.headline,
      robots: { index: false, follow: false },
      metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? `https://${brand.domain}`),
      openGraph: {
        title: share.headline,
        images: [`/api/v1/og/share/${token}?format=landscape&locale=${share.locale}`],
      },
    };
  } catch {
    return { robots: { index: false, follow: false } };
  }
}
/** Render only the explicitly selected reveal level, with language switch and create-your-own CTA. */
export default async function SharePage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ locale?: string }>;
}) {
  const { token } = await params,
    { locale } = await searchParams;
  let share;
  try {
    share = await publicShare(token, locale && isLocale(locale) ? locale : undefined);
  } catch {
    notFound();
  }
  const t = await getTranslations({ locale: share.locale }),
    copy = await shareCopy(share.locale);
  return (
    <article className="public-share" lang={share.locale}>
      <nav className="action-row">
        <a
          className="text-link"
          href={`/${share.locale}/${share.system === 'daily' ? 'today' : `${share.system}/new`}`}
        >
          {copy('share.try')}
        </a>
        {(['zh', 'zh-TW', 'en'] as const).map((locale) => (
          <a
            key={locale}
            href={`/s/${token}?locale=${locale}`}
            hrefLang={locale}
            aria-current={locale === share.locale ? 'page' : undefined}
          >
            {copy(`nav.locale.${locale}`)}
          </a>
        ))}
      </nav>
      <h1 className="type-h1">{t(runtimeKey('report.content'), { text: share.headline })}</h1>
      <div className="report-card">
        <p>{share.keywords.map((text) => t(runtimeKey('report.content'), { text })).join(' · ')}</p>
        <ul>
          {Object.entries(share.scores).map(([key, n]) => (
            <li key={key}>
              {copy(`daily.dimension.${key}`)} · {'★'.repeat(n)}
            </li>
          ))}
        </ul>
      </div>
      {share.daily ? (
        <section className="report-card">
          <time dateTime={share.daily.date}>{share.daily.date}</time>
          <p>{t(runtimeKey('report.content'), { text: share.daily.headline })}</p>
          <p>
            {'★'.repeat(share.daily.stars)} ·{' '}
            {t(runtimeKey('report.content'), { text: share.daily.color })} ·{' '}
            {share.daily.numbers.join(' / ')}
          </p>
        </section>
      ) : null}
      {share.diagram ? (
        <section className="report-card">
          <h2>{copy('share.diagram')}</h2>
          <ShareDiagram diagram={share.diagram} translate={copy} />
        </section>
      ) : null}
      {share.sections?.map((s, i) => (
        <section className="report-card" key={i}>
          <h2>{t(runtimeKey('report.content'), { text: s.title })}</h2>
          {s.text.map((text, n) => (
            <p key={n}>{t(runtimeKey('report.content'), { text })}</p>
          ))}
          {s.evidence.length ? (
            <details>
              <summary>{copy('report.evidence')}</summary>
              <ul>
                {s.evidence.map((item, n) => (
                  <li key={n}>
                    {t(runtimeKey('report.content'), { text: `${item.label}: ${item.value}` })}
                  </li>
                ))}
              </ul>
            </details>
          ) : null}
          {s.sources.length ? (
            <details>
              <summary>{copy('report.sources')}</summary>
              {s.sources.map((source, n) => (
                <blockquote key={n}>
                  {t(runtimeKey('report.content'), { text: source.text })}
                  <cite>{t(runtimeKey('report.content'), { text: source.from })}</cite>
                </blockquote>
              ))}
            </details>
          ) : null}
        </section>
      ))}
      <p>{copy('report.disclaimer.short')}</p>
    </article>
  );
}
