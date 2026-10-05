import { z } from 'zod';
// DESIGN-GAP: Announcement scope uses public route prefixes; maintenance remains bypassable for admin, authentication and health/cron APIs.
export const SiteConfigSchema = z
  .object({
    announcement: z
      .object({
        zh: z.string().max(1000),
        en: z.string().max(1000),
        scope: z.array(z.string().regex(/^\/(?:[a-z0-9/-]*)$/)).max(20),
        startsAt: z.string().datetime().nullable(),
        endsAt: z.string().datetime().nullable(),
      })
      .strict()
      .refine((v) => !v.startsAt || !v.endsAt || v.startsAt < v.endsAt),
    'ads.enabled': z.boolean(),
    'feature.llmPolish': z.boolean(),
    // DESIGN-GAP: B-05 specifies configurable quotas but no keys; keep them under the chat namespace.
    'feature.llmChat': z.boolean().default(false),
    'chat.freeDailyLimit': z.number().int().min(0).max(10000).default(3),
    'chat.proDailyLimit': z.number().int().min(0).max(10000).default(30),
    'feature.panchangDefaultOpen': z.boolean(),
    maintenance: z.boolean(),
  })
  .strict();
export type SiteSettings = z.infer<typeof SiteConfigSchema>;
