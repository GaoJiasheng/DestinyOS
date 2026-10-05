import { ImageResponse } from 'next/og';
import { brand, type Locale } from '@tianji/shared';
import { localeText } from '@tianji/shared/locale';
import { getCopy } from '@/i18n/get-copy';
import { resourceBytes } from './platform/resources';
import { publicPageCatalog } from './public-seo';

/** Render public editorial metadata only; unknown or private destinations return no image. */
export async function renderPublicOg(locale: Locale, path: string) {
  const page = (await publicPageCatalog(locale)).get(path);
  if (!page) return null;
  const t = await getCopy(locale);
  const font = await resourceBytes('resources/og-font.ttf');
  // DESIGN-GAP: The shared public OG template uses the documented dark/gold palette and a self-hosted font; long titles are bounded to keep the 1200×630 frame readable.
  return new ImageResponse(
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        width: '100%',
        height: '100%',
        padding: 64,
        background: 'radial-gradient(ellipse at 25% 20%, #111628, #05070F 75%)',
        color: '#F3F1EA',
        fontFamily: 'Tianji',
        border: '8px solid #D4AF6A',
      }}
    >
      <div
        style={{ display: 'flex', justifyContent: 'space-between', fontSize: 28, color: '#D4AF6A' }}
      >
        <span>
          {t(locale === 'en' ? 'brand.nameEn' : 'brand.nameZh', {
            name: localeText(locale === 'en' ? brand.nameEn : brand.nameZh, locale),
          })}
        </span>
        <span>{t('learn.ogLabel')}</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
        <div style={{ display: 'flex', fontSize: 52, lineHeight: 1.3 }}>
          {t('report.content', { text: page.title.slice(0, 85) })}
        </div>
        <div style={{ display: 'flex', fontSize: 25, lineHeight: 1.5, color: '#B8B5AC' }}>
          {t('report.content', { text: page.description.slice(0, locale === 'en' ? 180 : 90) })}
        </div>
      </div>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          fontSize: 19,
          color: '#B8B5AC',
        }}
      >
        <span>{t('report.content', { text: brand.domain })}</span>
        <span>{t('report.disclaimer.short')}</span>
      </div>
    </div>,
    {
      width: 1200,
      height: 630,
      fonts: [{ name: 'Tianji', data: font, weight: 400, style: 'normal' }],
      headers: { 'Cache-Control': 'public, max-age=86400, s-maxage=86400' },
    },
  );
}
