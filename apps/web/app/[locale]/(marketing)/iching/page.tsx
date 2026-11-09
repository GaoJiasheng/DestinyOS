import { publicRouteMetadata } from '@/lib/public-seo';
import { setRequestLocale } from 'next-intl/server';
import { getCopy } from '@/i18n/get-copy';
import { Link } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';
import {
  SYSTEM_TOOL_ANCHOR,
  SystemLandingBody,
  SystemLandingHero,
} from '@/components/landing/system-landing';
export const revalidate = 3600;
/** Four documented methods lead to the shared question and casting ritual. */
export default async function IchingPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getCopy();
  return (
    <>
      <SystemLandingHero locale={locale} system="iching" startHref={`#${SYSTEM_TOOL_ANCHOR}`} />
      <section id={SYSTEM_TOOL_ANCHOR} className="birth-shell">
        <p className="eyebrow">{t('nav.iching')}</p>
        <h2 className="type-h1">{t('divination.chooseMethod')}</h2>
        <div className="method-cards">
          {(['time', 'numbers', 'random', 'liuyao'] as const).map((method) => (
            <article className="birth-card" key={method}>
              <h3 className="type-h2">{t(`divination.methods.${method}`)}</h3>
              <p className="muted">{t(`divination.methodHelp.${method}`)}</p>
              <Button asChild>
                <Link href={`/iching/cast?method=${method}`}>
                  {t(`divination.methods.${method}`)}
                </Link>
              </Button>
            </article>
          ))}
        </div>
      </section>
      <SystemLandingBody locale={locale} system="iching" />
    </>
  );
}

/** Public system entry metadata uses the documented method introduction. */
export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  return publicRouteMetadata(params, '/iching');
}
