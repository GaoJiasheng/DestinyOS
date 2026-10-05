import { z } from 'zod';
// DESIGN-GAP: Export uses an owner-only API, with explicit format/theme and the existing report ID.
export const ExportRequestSchema = z
  .object({
    readingId: z.string().regex(/^[a-zA-Z0-9-]{1,64}$/),
    locale: z.enum(['zh', 'en', 'zh-TW']),
    theme: z.enum(['dark', 'light']).default('dark'),
    format: z.enum(['pdf', 'png', 'cover']),
  })
  .strict();
export type ExportRequest = z.infer<typeof ExportRequestSchema>;
export const EXPORT_VERSION = 'a4-v6';
export const EXPORT_TTL = 86400;
/** Resolve free/member entitlement without treating an anonymous viewer as an owner. */
export function canExport(plan: 'free' | 'pro', freeEnabled: boolean): boolean {
  return plan === 'pro' || freeEnabled;
}
