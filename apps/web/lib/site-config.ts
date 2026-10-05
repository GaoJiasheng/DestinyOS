import { getDb } from './db';
import { cacheRead, cacheWrite } from './cache';
export { SiteConfigSchema } from './site-config-schema';
import { SiteConfigSchema, type SiteSettings } from './site-config-schema';
export type { SiteSettings } from './site-config-schema';
/** Resolve database configuration through a sixty-second cache, with documented environment defaults. */
export async function siteConfig(): Promise<SiteSettings> {
  const defaults: SiteSettings = {
    announcement: { zh: '', en: '', scope: ['/'], startsAt: null, endsAt: null },
    'ads.enabled': process.env.FEATURE_ADS === 'true',
    'feature.llmPolish': false,
    // DESIGN-GAP: Chat config is runtime-only; Turbo passes MINIMAX_* and FEATURE_LLM_CHAT through strict mode without embedding secrets.
    'feature.llmChat': process.env.FEATURE_LLM_CHAT === 'true',
    'chat.freeDailyLimit': 3,
    'chat.proDailyLimit': 30,
    'feature.panchangDefaultOpen': false,
    maintenance: false,
  };
  if (!process.env.DATABASE_URL) return defaults;
  try {
    const cached = await cacheRead<unknown>('site-config');
    const valid = SiteConfigSchema.safeParse(cached);
    if (valid.success) return valid.data;
    const rows = await getDb().siteConfig.findMany();
    const settings = SiteConfigSchema.parse({
      ...defaults,
      ...Object.fromEntries(rows.map((r) => [r.key, r.value])),
    });
    try {
      await cacheWrite('site-config', settings, 60);
    } catch {
      /* Database value remains authoritative. */
    }
    return settings;
  } catch {
    return defaults;
  }
}
