import { z } from 'zod';
import {
  BirthInputSchema,
  ReadingRequestSchema,
  JournalInputSchema,
  JournalPredictionSchema,
  MobilePreferencesSchema,
  IanaTimezoneSchema,
  Locale,
} from '@tianji/shared';
import type { ApiEndpoint } from './index';
const token = z.string().regex(/^[A-Za-z0-9_-]{43}$/);
export const MobileTokensSchema = z.object({
  accessToken: token,
  refreshToken: token,
  tokenType: z.literal('Bearer'),
  expiresIn: z.number().positive(),
  refreshExpiresIn: z.number().positive(),
  sessionId: z.string().uuid(),
  userId: z.string().min(1),
});
export type MobileTokens = z.infer<typeof MobileTokensSchema>;
export const MobileDeviceSchema = z.object({
  deviceName: z.string().min(1).max(100),
  platform: z.enum(['ios', 'android']),
});
export const MobileSettingsSchema = MobilePreferencesSchema.partial().extend({
  locale: z.nativeEnum(Locale).optional(),
  soundOn: z.boolean().optional(),
  reducedMotion: z.boolean().optional(),
  tz: IanaTimezoneSchema.nullable().optional(),
  name: z.string().max(80).nullable().optional(),
});
const base = z.object({
  id: z.string().min(1).max(100),
  updatedAt: z.string().datetime({ offset: true }),
});
const deleted = base.extend({ deleted: z.literal(true) });
export const MobileProfileMetadataSchema = z.object({
  label: z.string().min(1).max(80),
  relation: z.enum(['self', 'partner', 'family', 'friend', 'other']),
});
const profile = base.extend({
  deleted: z.literal(false),
  birth: BirthInputSchema,
  metadata: MobileProfileMetadataSchema,
  version: z.number().int().positive(),
  isDefault: z.boolean(),
});
const reading = base.extend({
  deleted: z.literal(false),
  request: ReadingRequestSchema,
  profileId: z.string().nullable(),
  profileVersion: z.number().int().positive().nullable().optional(),
  system: z.string(),
  chart: z.record(z.unknown()),
  reportZh: z.record(z.unknown()).nullable(),
  reportEn: z.record(z.unknown()).nullable(),
  schoolUsed: z.record(z.unknown()),
  engineVersion: z.string(),
  interpretVersion: z.string(),
  knowledgeVersion: z.string(),
  title: z.string().nullable(),
  createdAt: z.string().datetime({ offset: true }),
});
const journal = base.extend({
  deleted: z.literal(false),
  profileId: z.string(),
  date: JournalInputSchema.shape.date,
  mood: JournalInputSchema.shape.mood,
  text: JournalInputSchema.shape.text,
  prediction: JournalPredictionSchema,
  createdAt: z.string().datetime({ offset: true }),
});
const settings = base.extend({ deleted: z.literal(false), settings: MobileSettingsSchema });
export const mobileResources = ['profiles', 'readings', 'journal', 'settings'] as const;
export type MobileResource = (typeof mobileResources)[number];
export const MobileSyncItemSchema = z.union([deleted, profile, reading, journal, settings]);
export type MobileSyncItem = z.infer<typeof MobileSyncItemSchema>;
export const MobileSyncPageSchema = z.object({
  items: z.array(MobileSyncItemSchema),
  cursor: z.string().max(1000),
  hasMore: z.boolean(),
});
/** Build a typed mobile endpoint using the same transport/error envelope as Web. */
export function mobileEndpoint<I extends z.ZodType<unknown>, O extends z.ZodType<unknown>>(
  path: string,
  method: ApiEndpoint<I, O>['method'],
  input: I,
  output: O,
): ApiEndpoint<I, O> {
  return {
    path: `/api/v1/mobile/${path}`,
    method,
    input,
    output,
    encode: (data) =>
      method === 'GET' ? { query: z.record(z.string()).parse(data) } : { body: data },
  };
}
export const mobileChallengeEndpoint = mobileEndpoint(
  'auth/challenge',
  'POST',
  MobileDeviceSchema.extend({ provider: z.enum(['apple', 'google']), codeChallenge: token }),
  z.object({ challengeId: z.string().uuid(), nonce: token, expiresIn: z.number() }),
);
export const mobileOAuthEndpoint = (provider: 'apple' | 'google') =>
  mobileEndpoint(
    `auth/${provider}`,
    'POST',
    z.object({
      challengeId: z.string().uuid(),
      codeVerifier: z.string().min(43).max(128),
      idToken: z.string().min(1).max(12000),
      locale: z.nativeEnum(Locale),
    }),
    MobileTokensSchema,
  );
export const mobileMagicRequestEndpoint = mobileEndpoint(
  'auth/magic/request',
  'POST',
  z.object({ email: z.string().trim().toLowerCase().email(), locale: z.nativeEnum(Locale) }),
  z.object({ sent: z.literal(true) }),
);
export const mobileMagicVerifyEndpoint = mobileEndpoint(
  'auth/magic/verify',
  'POST',
  MobileDeviceSchema.extend({
    email: z.string().trim().toLowerCase().email(),
    token: z.string().regex(/^[A-Za-z0-9_-]{16,256}$/),
    locale: z.nativeEnum(Locale),
  }),
  MobileTokensSchema,
);
export const mobileRefreshEndpoint = mobileEndpoint(
  'auth/refresh',
  'POST',
  z.object({ refreshToken: token }),
  MobileTokensSchema,
);
export const mobileLogoutEndpoint = mobileEndpoint(
  'auth/logout',
  'POST',
  z.object({}),
  z.object({ loggedOut: z.literal(true) }),
);
export const MobileSessionsSchema = z.object({
  sessions: z.array(
    z.object({
      id: z.string(),
      deviceName: z.string(),
      platform: z.enum(['ios', 'android']),
      createdAt: z.string().datetime({ offset: true }),
      lastUsedAt: z.string().datetime({ offset: true }),
      current: z.boolean(),
    }),
  ),
});
export const mobileSessionsEndpoint = mobileEndpoint(
  'auth/sessions',
  'GET',
  z.object({}),
  MobileSessionsSchema,
);
export const mobileRevokeEndpoint = mobileEndpoint(
  'auth/sessions',
  'DELETE',
  z.object({ sessionId: z.string() }),
  z.object({ revoked: z.literal(true) }),
);
export const mobileDeleteEndpoint = mobileEndpoint(
  'account',
  'DELETE',
  z.object({ confirmText: z.literal('DELETE'), deleteFeedback: z.boolean().optional() }),
  z.object({ deleted: z.literal(true) }),
);
export const mobilePullEndpoint = (resource: MobileResource) =>
  mobileEndpoint(
    `sync/${resource}`,
    'GET',
    z.object({ since: z.string().optional() }),
    MobileSyncPageSchema,
  );
const uploads = {
  profiles: z.union([
    deleted,
    profile.omit({ version: true, isDefault: true }).extend({ locale: z.nativeEnum(Locale) }),
  ]),
  readings: z.union([
    deleted,
    base.extend({
      deleted: z.literal(false),
      request: ReadingRequestSchema,
      createdAt: z.string().datetime(),
      title: z.string().max(120).nullable().optional(),
    }),
  ]),
  journal: z.union([
    deleted,
    base.extend({
      deleted: z.literal(false),
      entry: JournalInputSchema,
      locale: z.nativeEnum(Locale),
    }),
  ]),
  settings: settings,
};
export const mobilePushEndpoint = (resource: MobileResource) =>
  mobileEndpoint(
    `sync/${resource}`,
    'PUT',
    z.object({ items: z.array(uploads[resource]).max(resource === 'settings' ? 1 : 50) }),
    z.object({ items: z.array(MobileSyncItemSchema) }),
  );

/** Android Google code exchange reuses the provider route and supplies both PKCE proofs. */
export const mobileGoogleCodeEndpoint = mobileEndpoint(
  'auth/google',
  'POST',
  z.object({
    challengeId: z.string().uuid(),
    codeVerifier: z.string().min(43).max(128),
    authorizationCode: z.string().min(1).max(4096),
    providerCodeVerifier: z.string().min(43).max(128),
    locale: z.nativeEnum(Locale),
  }),
  MobileTokensSchema,
);
