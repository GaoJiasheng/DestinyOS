import { z } from 'zod';
import {
  BirthInputSchema,
  JournalInputSchema,
  JournalPredictionSchema,
  ReadingRequestSchema,
  System,
  ReadingStatus,
  Locale,
  IanaTimezoneSchema,
  EngineMetaSchema,
} from '@tianji/shared';

const id = z.string().min(1).max(100);
export const TimestampSchema = z
  .string()
  .datetime()
  .refine((value) => new Date(value).toISOString() === value);
export const MetadataSchema = z
  .object({
    id,
    userId: id.nullable(),
    createdAt: TimestampSchema,
    updatedAt: TimestampSchema,
    deletedAt: TimestampSchema.nullable(),
  })
  .strict();
export type Metadata = z.infer<typeof MetadataSchema>;
export const ProfileSchema = z
  .object({
    name: z.string().trim().max(80),
    birth: BirthInputSchema,
    // DESIGN-GAP: Store per-profile school defaults alongside the encrypted birth payload;
    // the App plan does not specify their persistence fields. Defaults match docs/04.
    options: z
      .object({
        school: z
          .object({
            useApparentSolarTime: z.boolean().default(true),
            ziHour: z.enum(['zi_unified', 'zi_split']).default('zi_unified'),
            houseSystem: z.enum(['placidus', 'whole_sign', 'equal']).default('placidus'),
            leapMonth: z.enum(['split_by_15', 'as_prev', 'as_next']).default('split_by_15'),
          })
          .strict(),
      })
      .strict()
      .optional(),
    version: z.number().int().positive(),
    isCurrent: z.literal(true),
  })
  .strict();
// DESIGN-GAP: The encrypted device snapshot retains complete engine/report JSON for offline
// replay. Shared schemas validate reading requests; rendering uses the shared Report type.
const jsonObject = z.record(z.unknown()).refine((value) => {
  try {
    return JSON.stringify(value).length <= 300_000;
  } catch {
    return false;
  }
});
export const ReadingSchema = z
  .object({
    profileId: id.nullable(),
    profileVersion: z.number().int().positive().nullable(),
    system: z.nativeEnum(System),
    status: z.nativeEnum(ReadingStatus),
    inputSnapshot: ReadingRequestSchema.omit({ system: true }).extend({
      system: z.nativeEnum(System),
    }),
    chart: jsonObject,
    reportZh: jsonObject.nullable(),
    reportEn: jsonObject.nullable(),
    schoolUsed: jsonObject,
    // DESIGN-GAP: Preserve the shared engine envelope so native replay retains every warning
    // and intermediate calculation, including old-profile reports and house-system fallback.
    meta: EngineMetaSchema.optional(),
    engineVersion: z.string().min(1),
    interpretVersion: z.string().min(1),
    knowledgeVersion: z.string().min(1),
    title: z.string().max(200).nullable(),
    isPublic: z.literal(false),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.system !== value.inputSnapshot.system)
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['system'] });
    if ((value.profileId === null) !== (value.profileVersion === null))
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['profileVersion'] });
  });
export const JournalSchema = JournalInputSchema.extend({
  prediction: JournalPredictionSchema,
}).strict();
// DESIGN-GAP: Native-only preference field names/defaults are centralized until M11 UI/API
// contracts exist. Use the documented Web settings names and App's 08:00/default-on decisions.
export const SettingsSchema = z
  .object({
    locale: z.nativeEnum(Locale).default('zh'),
    theme: z.enum(['auto', 'east', 'west', 'vedic']).default('auto'),
    soundOn: z.boolean().default(false),
    reducedMotion: z.boolean().default(false),
    tz: IanaTimezoneSchema.nullable().default(null),
    dailyPushEnabled: z.boolean().default(true),
    dailyPushTime: z
      .string()
      .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
      .default('08:00'),
    specialDayReminders: z.boolean().default(true),
    widgetTheme: z.enum(['auto', 'east', 'west', 'vedic']).default('auto'),
    hapticsOn: z.boolean().default(true),
    activeProfileId: id.nullable().default(null),
    // DESIGN-GAP: Version the onboarding acknowledgement in encrypted local settings.
    onboardingVersion: z.number().int().nonnegative().default(0),
    // DESIGN-GAP: Persist the native COPPA gate across restarts; there is no Web session cookie.
    ageBlocked: z.boolean().default(false),
  })
  .strict();
export const schemas = {
  BirthProfile: ProfileSchema,
  Reading: ReadingSchema,
  JournalEntry: JournalSchema,
  Settings: SettingsSchema,
};
export type Entity = keyof typeof schemas;
export type EntityData<K extends Entity> = z.infer<(typeof schemas)[K]>;
export type LocalRecord<T> = Metadata & { data: T | null };
export type Profile = z.infer<typeof ProfileSchema>;
export type LocalReading = z.infer<typeof ReadingSchema>;
export type Settings = z.infer<typeof SettingsSchema>;
