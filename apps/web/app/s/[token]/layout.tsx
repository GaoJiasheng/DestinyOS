import { headers } from 'next/headers';
import { publicShare } from '@/lib/share-service';
import '../../globals.css';
import '../../[locale]/fonts.css';
/** Public shares use the selected snapshot language for their independent root document. */
export default async function ShareLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ token: string }>;
}) {
  const requested = (await headers()).get('x-share-locale');
  let locale: 'zh' | 'en' = requested === 'en' ? 'en' : 'zh';
  try {
    locale = (
      await publicShare(
        (await params).token,
        requested === 'zh' || requested === 'en' ? requested : undefined,
      )
    ).locale;
  } catch {
    // DESIGN-GAP: Invalid or revoked share pages use Chinese as their document-language fallback.
  }
  return (
    <html lang={locale}>
      <body>
        <main>{children}</main>
      </body>
    </html>
  );
}
