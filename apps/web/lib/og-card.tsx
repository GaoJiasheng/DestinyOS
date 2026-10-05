import { localeText } from '@tianji/shared/locale';
import { ShareDiagram } from '@/components/share/share-diagram';
import { ImageResponse } from '@vercel/og';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { webDirectory } from './server-resources';
import { brand } from '@tianji/shared';
import type { PublicShare, DailyCard } from './share-projection';
import { publicText } from './share-projection';
import { shareCopy } from './share-copy';
import QRCode from 'qrcode';
// DESIGN-GAP: Satori cannot read browser theme variables; embedded image values mirror docs/03 tokens.
const palette = { surface: '#111628', gold: '#D4AF6A', text: '#F3F1EA', line: '#6C9BE0' };
/** Extract bounded display text shared by all three image templates; this is also the privacy test boundary. */
export function cardText(card: PublicShare | DailyCard) {
  return 'system' in card
    ? [card.headline, ...card.keywords.slice(0, 4)]
    : [card.headline, card.color, card.numbers.join(' / '), ...card.do, ...card.dont];
}
/** Render self-hosted font subsets using satori, without fetching external fonts or assets. */
export async function renderCard(
  card: PublicShare | DailyCard,
  format: 'story' | 'landscape' = 'landscape',
  destination?: string,
) {
  const copy = await shareCopy(card.locale);
  const template = 'system' in card ? card.template : 'daily',
    story = format === 'story',
    width = story ? 1080 : 1200,
    height = story ? 1920 : 630;
  const [font, cinzel, cormorant, qr] = await Promise.all([
    readFile(resolve(webDirectory(), 'resources/og-font.ttf')),
    readFile(
      resolve(webDirectory(), 'node_modules/@fontsource/cinzel/files/cinzel-latin-600-normal.woff'),
    ),
    readFile(
      resolve(
        webDirectory(),
        'node_modules/@fontsource/cormorant-garamond/files/cormorant-garamond-latin-600-normal.woff',
      ),
    ),
    QRCode.toDataURL(destination ?? `https://${brand.domain}/${card.locale}/today`, {
      width: 156,
      margin: 4,
      errorCorrectionLevel: 'M',
    }),
  ]);
  const colors = { chart: palette.gold, quote: palette.gold, daily: palette.gold };
  const headline = publicText(card.headline).slice(0, 120);
  const scores = 'system' in card ? Object.entries(card.scores) : [];
  return new ImageResponse(
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        position: 'relative',
        background: 'radial-gradient(ellipse at 30% 20%, #0D1330, #05070F 70%)',
        color: palette.text,
        width: '100%',
        height: '100%',
        padding: story ? 100 : 48,
        fontFamily: 'Tianji',
        border: `12px solid ${colors[template]}`,
      }}
    >
      <svg width={width} height={height} style={{ position: 'absolute', left: 0, top: 0 }}>
        {Array.from({ length: 64 }, (_, i) => (
          <circle
            key={i}
            cx={(i * 137 + 24) % width}
            cy={(i * 211 + 48) % height}
            r={i % 5 ? 1 : 2}
            fill={palette.gold}
            opacity="0.5"
          />
        ))}
      </svg>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: 26,
          color: colors[template],
          fontFamily: card.locale === 'en' ? 'Cinzel' : 'Tianji',
        }}
      >
        <span>
          {copy(card.locale !== 'en' ? 'brand.nameZh' : 'brand.nameEn', {
            name: card.locale !== 'en' ? localeText(brand.nameZh, card.locale) : brand.nameEn,
          })}
        </span>
        <span>{'date' in card ? card.date : copy(`share.template.${template}`)}</span>
      </div>
      <div
        style={{
          display: 'flex',
          flexDirection: story ? 'column' : 'row',
          gap: 32,
          alignItems: 'center',
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 24,
            width: story || template !== 'chart' ? '100%' : '66%',
          }}
        >
          <div
            style={{
              display: 'flex',
              fontSize: story ? 66 : 38,
              lineHeight: 1.5,
              fontFamily:
                card.locale === 'en'
                  ? 'system' in card && ['bazi', 'ziwei', 'iching', 'qimen'].includes(card.system)
                    ? 'Cormorant'
                    : 'Cinzel'
                  : 'Tianji',
            }}
          >
            {copy('report.content', { text: headline })}
          </div>
          <div style={{ display: 'flex', gap: 24, fontSize: 24, color: colors[template] }}>
            {'system' in card ? (
              card.keywords.slice(0, 4).map((k, i) => (
                <span key={i} style={{ marginRight: 24 }}>
                  {copy('report.content', { text: publicText(k) })}
                </span>
              ))
            ) : (
              <>
                <span style={{ marginRight: 24 }}>{'★'.repeat(card.stars)}</span>
                <span style={{ marginRight: 24 }}>
                  {copy('report.content', { text: card.color })}
                </span>
                <span>{card.numbers.join(' / ')}</span>
              </>
            )}
          </div>
          {template === 'quote' ? (
            <div style={{ display: 'flex', gap: 16, fontSize: 22 }}>
              {scores.map(([key, value]) => (
                <span key={key} style={{ marginRight: 16 }}>
                  {copy(`daily.dimension.${key}`)} {'★'.repeat(value)}
                </span>
              ))}
            </div>
          ) : null}
          {template === 'daily' && 'date' in card ? (
            <div style={{ display: 'flex', width: '100%', fontSize: 22, lineHeight: 1.5 }}>
              {(['do', 'dont'] as const).map((key) => (
                <div
                  key={key}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    width: '48%',
                    marginRight: key === 'do' ? '4%' : 0,
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      fontSize: 18,
                      color: colors[template],
                      marginBottom: 8,
                    }}
                  >
                    {copy(`daily.${key}`)}
                  </div>
                  <div style={{ display: 'flex' }}>
                    {copy('report.content', { text: card[key].map(publicText).join(' · ') })}
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </div>
        {template === 'chart' && 'system' in card ? (
          <div style={{ display: 'flex', width: story ? '100%' : '30%', justifyContent: 'center' }}>
            {card.diagram ? (
              <ShareDiagram diagram={card.diagram} translate={copy} colors={palette} />
            ) : (
              // DESIGN-GAP: At revealLevel zero only public scores form the miniature graphic; private chart fields remain absent.
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 12,
                  width: '100%',
                  fontSize: 18,
                }}
              >
                {scores.map(([key, value]) => (
                  <div
                    key={key}
                    style={{ display: 'flex', justifyContent: 'space-between', gap: 16 }}
                  >
                    <span>{copy(`daily.dimension.${key}`)}</span>
                    <span style={{ color: palette.gold }}>{'★'.repeat(value)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : null}
      </div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 32,
          fontSize: 18,
          color: '#B8B5AC',
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
            width: '75%',
            lineHeight: 1.4,
          }}
        >
          <span>{copy('report.content', { text: brand.domain })}</span>
          <span>{copy('report.disclaimer.short')}</span>
        </div>
        <img src={qr} width={156} height={156} alt={copy('share.copy')} />
      </div>
    </div>,
    {
      width,
      height,
      fonts: [
        { name: 'Tianji', data: font, weight: 400, style: 'normal' },
        { name: 'Cinzel', data: cinzel, weight: 600, style: 'normal' },
        { name: 'Cormorant', data: cormorant, weight: 600, style: 'normal' },
      ],
      headers: { 'Cache-Control': 'private, no-store' },
    },
  );
}
