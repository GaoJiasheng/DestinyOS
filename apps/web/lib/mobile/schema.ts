import { z } from 'zod';
import {
  BirthInputSchema,
  ReadingRequestSchema,
  JournalInputSchema,
  MobilePreferencesSchema,
  IanaTimezoneSchema,
} from '@tianji/shared';
import { SettingsSchema } from '../account-service-schema';
import { ProfileMetadataSchema } from '../profile-service';
export const idSchema = z.string().regex(/^[A-Za-z0-9_-]{1,100}$/);
export const localeSchema = z.enum(['zh', 'en', 'zh-TW']).default('zh');
export const deviceSchema = z.object({
  deviceName: z.string().trim().min(1).max(100),
  platform: z.enum(['ios', 'android']),
});
export const challengeSchema = deviceSchema
  .extend({
    provider: z.enum(['apple', 'google']),
    codeChallenge: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
  })
  .strict();
export const oauthSchema = z
  .object({
    challengeId: z.string().uuid(),
    codeVerifier: z.string().regex(/^[A-Za-z0-9._~-]{43,128}$/),
    idToken: z.string().min(1).max(12000),
    locale: localeSchema,
  })
  .strict();
export const magicSchema = deviceSchema
  .extend({
    email: z.string().trim().toLowerCase().email().max(254),
    token: z.string().regex(/^[a-zA-Z0-9_-]{16,256}$/),
    locale: localeSchema,
  })
  .strict();
export const magicRequestSchema = z
  .object({
    email: z.string().trim().toLowerCase().email().max(254),
    locale: localeSchema,
  })
  .strict();
export const refreshSchema = z
  .object({ refreshToken: z.string().regex(/^[A-Za-z0-9_-]{43}$/) })
  .strict();
export const resourceSchema = z.enum(['profiles', 'readings', 'journal', 'settings']);
export type Resource = z.infer<typeof resourceSchema>;
const timestamp = z
  .string()
  .datetime({ offset: true })
  .refine((value) => Date.parse(value) <= Date.now() + 300000, 'Future update timestamp');
const base = z.object({ id: idSchema, updatedAt: timestamp });
const deleted = base.extend({ deleted: z.literal(true) }).strict();
// DESIGN-GAP: Sync accepts bounded batches of stable IDs with UTC edit times; stale writes return authoritative server records.
export const profileSyncSchema = z
  .object({
    items: z
      .array(
        z.union([
          deleted,
          base
            .extend({
              deleted: z.literal(false),
              birth: BirthInputSchema,
              metadata: ProfileMetadataSchema,
              locale: localeSchema,
            })
            .strict(),
        ]),
      )
      .max(50),
  })
  .strict();
export const readingSyncSchema = z
  .object({
    items: z
      .array(
        z.union([
          deleted,
          base
            .extend({
              deleted: z.literal(false),
              request: ReadingRequestSchema,
              createdAt: timestamp,
              title: z.string().trim().max(120).nullable().optional(),
            })
            .strict(),
        ]),
      )
      .max(50),
  })
  .strict();
export const journalSyncSchema = z
  .object({
    items: z
      .array(
        z.union([
          deleted,
          base
            .extend({ deleted: z.literal(false), entry: JournalInputSchema, locale: localeSchema })
            .strict(),
        ]),
      )
      .max(50),
  })
  .strict();
export const MobileSettingsSchema = z
  .object({
    ...SettingsSchema.innerType().shape,
    ...MobilePreferencesSchema.partial().shape,
    tz: IanaTimezoneSchema.nullable().optional(),
  })
  .strict();
export const settingsSyncSchema = z
  .object({
    items: z
      .array(base.extend({ deleted: z.literal(false), settings: MobileSettingsSchema }).strict())
      .max(1),
  })
  .strict();
