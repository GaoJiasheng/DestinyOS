import { publicRouteMetadata } from '@/lib/public-seo';
import { ClientMessages } from '@/i18n/client-provider';
import { getMessages, setRequestLocale } from 'next-intl/server';
import { TarotSelection } from '@/components/tarot/tarot-selection';
import {
  SYSTEM_TOOL_ANCHOR,
  SystemLandingBody,
  SystemLandingBridge,
} from '@/components/landing/system-landing';
// DESIGN-GAP: Public spread selection serializes only tarot, artwork and loading labels, keeping unrelated report/glossary prose out of the document.
export const revalidate = 3600;
/** Public spread selection: no birth profile is needed. */
export default async function TarotPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const messages = await getMessages();
  return (
    <>
      <div id={SYSTEM_TOOL_ANCHOR}>
        <ClientMessages
          messages={{
            tarot: messages.tarot ?? {},
            art: messages.art ?? {},
            common: messages.common ?? {},
          }}
        >
          <TarotSelection />
        </ClientMessages>
      </div>
      <SystemLandingBridge locale={locale} system="tarot" />
      <SystemLandingBody locale={locale} system="tarot" />
    </>
  );
}

/** Public system entry metadata uses the documented method introduction. */
export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  return publicRouteMetadata(params, '/tarot');
}
