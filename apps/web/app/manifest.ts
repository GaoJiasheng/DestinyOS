import type { MetadataRoute } from 'next';
import { brand } from '@tianji/shared/brand';
import { createTranslator } from 'next-intl';
import zh from '@/messages/zh.json';
import en from '@/messages/en.json';
import { toMessages } from '@/i18n/catalog';
/** Installable app shell; locale redirect selects the user's language on launch. */
export default function manifest(): MetadataRoute.Manifest {
  const chinese = createTranslator({ locale: 'zh', messages: toMessages(zh) });
  const english = createTranslator({ locale: 'en', messages: toMessages(en) });
  // DESIGN-GAP: A shared bilingual manifest preserves one install identity across locale changes.
  return {
    id: '/',
    name: `${chinese('brand.nameZh', { name: brand.nameZh })} · ${english('brand.nameEn', { name: brand.nameEn })}`,
    short_name: chinese('brand.nameZh', { name: brand.nameZh }),
    description: `${chinese('brand.tagline')} / ${english('brand.tagline')}`,
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#05070f',
    theme_color: '#05070f',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
