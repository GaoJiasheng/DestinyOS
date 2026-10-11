import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import QRCode from 'qrcode';
import { brand } from '@tianji/shared/brand';
import { isLocale } from '@/i18n/routing';
import { getCopy } from '@/i18n/get-copy';
import { PrintReport } from '@/components/report/print/print-report';
import { TarotMessages } from '@/components/tarot/tarot-messages';
import { ExportRequestSchema } from '@/lib/report-export-schema';
import { exportReading, verifyPrintToken } from '@/lib/report-export';
import { getDb } from '@/lib/db';
import '@fontsource/cormorant-garamond/400.css';
import '@fontsource-variable/noto-sans/wdth.css';
import './print.css';
export const dynamic = 'force-dynamic';
export const metadata = { robots: { index: false, follow: false } };
/** Owner-only standalone print view; renderer capability authorizes only this report and theme. */
export default async function PrintPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; system: string; id: string }>;
  searchParams: Promise<{ theme?: string; layout?: string }>;
}) {
  const { locale, system, id } = await params;
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);
  const query = await searchParams;
  const request = ExportRequestSchema.safeParse({
    readingId: id,
    locale,
    theme: query.theme ?? 'dark',
    format: query.layout === 'poster' ? 'png' : query.layout === 'cover' ? 'cover' : 'pdf',
  });
  if (!request.success) notFound();
  const token = (await headers()).get('x-report-print-token');
  const userId = token ? verifyPrintToken(token, request.data) : undefined;
  if (token && !userId) notFound();
  try {
    const { reading } = await exportReading(request.data, userId ?? undefined);
    if (reading.system !== system) notFound();
    // DESIGN-GAP: Only an existing public share is encoded; creating an export never publishes a private reading.
    const share = await getDb().shareLink.findFirst({
      where: {
        readingId: id,
        revokedAt: null,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      select: { token: true },
    });
    const url = share
      ? `https://${brand.domain}/s/${share.token}?locale=${locale}`
      : `https://${brand.domain}/${locale}`;
    const qr = await QRCode.toDataURL(url, { width: 300, margin: 1, errorCorrectionLevel: 'M' });
    const report = (
      <>
        <link rel="stylesheet" href="/fonts/fonts-body.css" />
        <link rel="stylesheet" href="/fonts/fonts-print.css" />
        <link rel="stylesheet" href="/fonts/fonts-print-symbols.css" />
        <PrintReport
          key={`${reading.id}:${locale}:${request.data.theme}:${request.data.format}`}
          reading={reading}
          theme={request.data.theme}
          qr={qr}
          layout={
            request.data.format === 'pdf'
              ? 'pdf'
              : request.data.format === 'cover'
                ? 'cover'
                : 'poster'
          }
        />
      </>
    );
    return system === 'tarot' ? <TarotMessages>{report}</TarotMessages> : report;
  } catch {
    const t = await getCopy();
    return (
      <section className="status-page" role="alert">
        <h1>{t('export.denied')}</h1>
      </section>
    );
  }
}
