import { setRequestLocale } from 'next-intl/server';
import { getCopy } from '@/i18n/get-copy';
import { TokenGallery } from '@/components/token-gallery';
/** Developer gallery for all global tokens and three theme-specific component sets. */
export default async function TokensPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getCopy();
  return (
    <div className="tokens-page">
      <header>
        <p className="eyebrow">{t('common.tokensLink')}</p>
        <h1 className="type-h1">{t('dev.tokens.title')}</h1>
        <p className="muted">{t('dev.tokens.description')}</p>
      </header>
      <TokenGallery />
    </div>
  );
}
