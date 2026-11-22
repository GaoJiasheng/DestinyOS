/** Single source of truth for public brand names and the canonical domain. */
export const brand = {
  nameZh: '天机',
  nameZhTW: '天機',
  nameEn: 'DestinyOS',
  domain: 'tianji.gavin.pub',
  /** App Store id of the iPhone app (public listing, live since 1.0.0). */
  iosAppId: '6819614010',
  tagline: {
    zh: '读懂你的时间与星辰',
    'zh-TW': '讀懂你的時間與星辰',
    en: 'Read your sky. Know your path.',
  },
} as const;
/** Country-neutral App Store listing; Apple redirects to the visitor's storefront. */
export const appStoreUrl = `https://apps.apple.com/app/id${brand.iosAppId}`;
