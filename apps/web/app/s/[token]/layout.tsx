import { isLocale } from '@/i18n/routing';
import { headers } from 'next/headers';
import { Starfield } from '@/components/starfield';
import { FontGlyphLoader } from '@/components/pwa/font-loader';
import { routeTheme } from '@/lib/themes';
import { publicShare } from '@/lib/share-service';
import { PublicPreferences } from '@/components/share/public-preferences';
import '../../globals.css';
import '../../[locale]/fonts.css';
import '@fontsource/cinzel/600.css';
import '@fontsource/cormorant-garamond/600.css';
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
/** Public shares use the selected snapshot language for their independent root document. */
export default async function ShareLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ token: string }>;
}) {
  const requested = (await headers()).get('x-share-locale');
  let locale: 'zh' | 'en' | 'zh-TW' = requested && isLocale(requested) ? requested : 'zh';
  let theme = routeTheme('/');
  try {
    const share = await publicShare(
      (await params).token,
      requested && isLocale(requested) ? requested : undefined,
    );
    locale = share.locale;
    // DESIGN-GAP: A public snapshot inherits its system theme because /s has no dedicated visual theme.
    theme = routeTheme(`/${share.system}`);
  } catch {
    // DESIGN-GAP: Invalid or revoked share pages use Chinese as their document-language fallback.
  }
  return (
    <html lang={locale} data-theme={theme} suppressHydrationWarning>
      <body>
        <PublicPreferences theme={theme} />
        <Starfield />
        <FontGlyphLoader revisionKey={`${(await params).token}:${locale}`} />
        <main>{children}</main>
      </body>
    </html>
  );
}
