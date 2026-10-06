import { z } from 'zod';
// DESIGN-GAP: Cross-device App preferences reuse the M04 field names and documented defaults;
// onboarding, notification permission hints and active-profile selection remain device-local.
export const MobilePreferencesSchema = z
  .object({
    theme: z.enum(['auto', 'east', 'west', 'vedic']).default('auto'),
    dailyPushEnabled: z.boolean().default(true),
    dailyPushTime: z
      .string()
      .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
      .default('08:00'),
    specialDayReminders: z.boolean().default(true),
    widgetTheme: z.enum(['auto', 'east', 'west', 'vedic']).default('auto'),
    hapticsOn: z.boolean().default(true),
  })
  .strict();
