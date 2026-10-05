import { z } from 'zod';
import { Temporal } from '@js-temporal/polyfill';
export const SettingsSchema = z
  .object({
    locale: z.enum(['zh', 'en', 'zh-TW']).optional(),
    theme: z.enum(['auto', 'east', 'west']).optional(),
    soundOn: z.boolean().optional(),
    reducedMotion: z.boolean().optional(),
    tz: z.string().max(100).nullable().optional(),
    name: z.string().trim().max(80).nullable().optional(),
  })
  .strict()
  .superRefine((v, c) => {
    if (v.tz) {
      try {
        Temporal.Now.zonedDateTimeISO(v.tz);
      } catch {
        c.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['tz'],
          message: 'Invalid IANA time zone',
        });
      }
    }
  });
