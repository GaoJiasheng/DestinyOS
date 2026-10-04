import { ShareDiagram } from '@/components/share/share-diagram';
import { ImageResponse } from '@vercel/og';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { webDirectory } from './server-resources';
import { brand } from '@tianji/shared';
import type { PublicShare, DailyCard } from './share-projection';
import { publicText } from './share-projection';
import { shareCopy } from './share-copy';
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
) {
  const copy = await shareCopy(card.locale);
  const template = 'system' in card ? card.template : 'daily',
    story = format === 'story',
    width = story ? 1080 : 1200,
    height = story ? 1920 : 630;
  const font = await readFile(resolve(webDirectory(), 'resources/og-font.ttf'));
  const colors = { chart: '#c9a66b', quote: '#aa8edc', daily: '#76bda7' };
  const headline = publicText(card.headline).slice(0, 120);
  const scores = 'system' in card ? Object.entries(card.scores) : [];
  return new ImageResponse(
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        background: 'radial-gradient(circle at 20% 0%, #292541, #080b17 70%)',
        color: '#f3eadb',
        width: '100%',
        height: '100%',
        padding: story ? 100 : 48,
        fontFamily: 'Tianji',
        border: `12px solid ${colors[template]}`,
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: 26,
          color: colors[template],
        }}
      >
        <span>
          {copy(card.locale === 'zh' ? 'brand.nameZh' : 'brand.nameEn', {
            name: card.locale === 'zh' ? brand.nameZh : brand.nameEn,
          })}
        </span>
        <span>{'date' in card ? card.date : copy(`share.template.${template}`)}</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        {template === 'chart' && 'diagram' in card && card.diagram ? (
          <ShareDiagram diagram={card.diagram} translate={copy} />
        ) : null}
        <div style={{ display: 'flex', fontSize: story ? 66 : 42, lineHeight: 1.5 }}>
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
      <div
        style={{ display: 'flex', justifyContent: 'space-between', fontSize: 18, color: '#b0adc1' }}
      >
        <div style={{ display: 'flex', width: '27%' }}>
          {copy('report.content', { text: brand.domain })}
        </div>
        <div
          style={{
            display: 'flex',
            width: '70%',
            justifyContent: 'flex-end',
            textAlign: 'right',
            lineHeight: 1.4,
          }}
        >
          {copy('report.disclaimer.short')}
        </div>
      </div>
    </div>,
    {
      width,
      height,
      fonts: [{ name: 'Tianji', data: font, weight: 400, style: 'normal' }],
      headers: { 'Cache-Control': 'private, no-store' },
    },
  );
}
