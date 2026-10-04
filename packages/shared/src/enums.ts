// Values follow docs/06-data-model.md; daily is a persisted System as well.
export const System = {
  bazi: 'bazi',
  ziwei: 'ziwei',
  iching: 'iching',
  qimen: 'qimen',
  tarot: 'tarot',
  astrology: 'astrology',
  vedic: 'vedic',
  daily: 'daily',
} as const;
export type System = (typeof System)[keyof typeof System];
export const Gender = { male: 'male', female: 'female', unspecified: 'unspecified' } as const;
export type Gender = (typeof Gender)[keyof typeof Gender];
export const Locale = { zh: 'zh', en: 'en' } as const;
export type Locale = (typeof Locale)[keyof typeof Locale];
export const Plan = { free: 'free', pro: 'pro' } as const;
export type Plan = (typeof Plan)[keyof typeof Plan];
export const ReadingStatus = { ok: 'ok', failed: 'failed' } as const;
export type ReadingStatus = (typeof ReadingStatus)[keyof typeof ReadingStatus];
export const Role = { user: 'user', admin: 'admin' } as const;
export type Role = (typeof Role)[keyof typeof Role];
export const KuStatus = {
  draft: 'draft',
  published: 'published',
  deprecated: 'deprecated',
} as const;
export type KuStatus = (typeof KuStatus)[keyof typeof KuStatus];
// docs/systems/astrology.md chart schema, including the documented koch option.
export const HouseSystem = {
  placidus: 'placidus',
  whole_sign: 'whole_sign',
  equal: 'equal',
  koch: 'koch',
} as const;
export type HouseSystem = (typeof HouseSystem)[keyof typeof HouseSystem];
