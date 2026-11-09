import zh from '@/messages/zh/landing.json';
import en from '@/messages/en/landing.json';
import zhTW from '@/messages/zh-TW/landing.json';

/** Nine public system entries, each with a route under /{locale}/{system}. */
export const landingSystems = [
  'bazi',
  'ziwei',
  'iching',
  'qimen',
  'tarot',
  'astrology',
  'vedic',
  'numerology',
  'synastry',
] as const;
export type LandingSystem = (typeof landingSystems)[number];

export type LandingEntry = {
  name: string;
  tagline: string;
  /** English-only sentence introducing the tradition to readers who have not met it. */
  background?: string;
  prepare: string;
  seo: { title: string; description: string };
  tells: { title: string; body: string }[];
  method: { title: string; body: string }[];
  sample: {
    caption: string;
    cells: { label: string; value: string }[];
    notes: { chapter: string; text: string; basis: string }[];
  };
  faq: { q: string; a: string }[];
  more: { href: string; label: string }[];
};
export type LandingLabels = Record<
  | 'start'
  | 'prepare'
  | 'tells'
  | 'method'
  | 'sample'
  | 'sampleBadge'
  | 'sampleNote'
  | 'basis'
  | 'faq'
  | 'more'
  | 'about',
  string
>;
type LandingCatalog = { labels: LandingLabels } & Record<LandingSystem, LandingEntry>;

// DESIGN-GAP: zh-TW is generated from zh by i18n:traditional (OpenCC at build time), like the other catalogs; the runtime dictionary only covers already-published prose.
const catalogs: Record<string, LandingCatalog> = { zh, en, 'zh-TW': zhTW };

export function landingLabels(locale: string): LandingLabels {
  return (catalogs[locale] ?? zh).labels;
}

export function landingCopy(locale: string, system: LandingSystem): LandingEntry {
  return (catalogs[locale] ?? zh)[system];
}

export function isLandingSystem(value: string): value is LandingSystem {
  return (landingSystems as readonly string[]).includes(value);
}

/** Build schema.org FAQPage data from the same entries that are rendered on the page. */
export function faqJsonLd(entry: Pick<LandingEntry, 'faq'>) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: entry.faq.map((item) => ({
      '@type': 'Question',
      name: item.q,
      acceptedAnswer: { '@type': 'Answer', text: item.a },
    })),
  };
}
