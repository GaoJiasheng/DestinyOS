import { ImageResponse } from 'next/og';
import { brand, type Locale } from '@tianji/shared';
import { localeText } from '@tianji/shared/locale';
import { getCopy } from '@/i18n/get-copy';
import { resourceBytes } from './platform/resources';
import { artDataUrl } from './art-resource';
import { isArtSystem } from '@tianji/ui-core/art';

/** Render public editorial metadata only; unknown or private destinations return no image. */
export async function renderPublicOgTemplate(
  locale: Locale,
  path: string,
  page: { title: string; description: string },
) {
  const t = await getCopy(locale);
  const font = await resourceBytes('resources/og-font.ttf');
  const system = path.split('/').filter(Boolean).find(isArtSystem);
  // DESIGN-GAP: System cards pair their cutout with the text-safe quote frame for a single main subject.
  const background = await artDataUrl(system ? 'share/quote-landscape' : 'brand/og-default');
  const illustration = system ? await artDataUrl(`systems/${system}`) : null;
  const illustrationAlt = system ? t(`art.systems.${system}`) : '';
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
        backgroundColor: '#05070F',
        backgroundImage: `url(${background})`,
        backgroundSize: '100% 100%',
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
        {/* DESIGN-GAP: A dark caption surface keeps gold lettering legible over painted highlights. */}
        <span
          style={{ backgroundColor: 'rgba(5,7,15,0.88)', borderRadius: 14, padding: '6px 12px' }}
        >
          {t('learn.ogLabel')}
        </span>
      </div>
      <div style={{ display: 'flex', gap: 28, alignItems: 'center' }}>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 28,
            width: illustration ? '70%' : '100%',
          }}
        >
          <div style={{ display: 'flex', fontSize: 52, lineHeight: 1.3 }}>
            {t('report.content', { text: page.title.slice(0, 85) })}
          </div>
          <div style={{ display: 'flex', fontSize: 25, lineHeight: 1.5, color: '#B8B5AC' }}>
            {t('report.content', { text: page.description.slice(0, locale === 'en' ? 180 : 90) })}
          </div>
        </div>
        {illustration ? (
          <img src={illustration} width={260} height={260} alt={illustrationAlt} />
        ) : null}
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
