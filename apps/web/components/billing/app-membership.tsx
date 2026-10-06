import QRCode from 'qrcode';
import { getCopy } from '@/i18n/get-copy';
import { appStoreUrl } from '@/lib/app-stores';
import { AppDownloadControls } from './app-download-controls';
/** Present existing Pro benefits and store links without any Stripe client or actions. */
export async function AppMembership() {
  const t = await getCopy();
  const stores = await Promise.all(
    (
      [
        ['apple', process.env.NEXT_PUBLIC_APP_STORE_URL],
        ['google', process.env.NEXT_PUBLIC_PLAY_STORE_URL],
      ] as const
    ).map(async ([kind, value]) => {
      const url = appStoreUrl(value);
      return { kind, url, qr: url ? await QRCode.toDataURL(url, { width: 160, margin: 2 }) : null };
    }),
  );
  return (
    <div>
      <p>{t('billing.proFeatures')}</p>
      <AppDownloadControls stores={stores} />
      <p>{t('billing.appTerms')}</p>
    </div>
  );
}
