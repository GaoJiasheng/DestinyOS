import { z } from 'zod';
// DESIGN-GAP: Export uses an owner-only API, with explicit format/theme and the existing report ID.
export const ExportRequestSchema = z
  .object({
    readingId: z.string().regex(/^[a-zA-Z0-9-]{1,64}$/),
    locale: z.enum(['zh', 'en', 'zh-TW']),
    theme: z.enum(['dark', 'light']).default('dark'),
    // DESIGN-GAP: Keep the existing png API enum for compatibility; its artifact is now one JPEG.
    format: z.enum(['pdf', 'png', 'cover']),
  })
  .strict();
export type ExportRequest = z.infer<typeof ExportRequestSchema>;
export const EXPORT_VERSION = 'onepage-a4-v2';
export const EXPORT_TTL = 86400;
/** Resolve free/member entitlement without treating an anonymous viewer as an owner. */
export function canExport(plan: 'free' | 'pro', freeEnabled: boolean): boolean {
  return plan === 'pro' || freeEnabled;
}

export const EXPORT_TIMEOUT_MS = 60000;
// DESIGN-GAP: A4/200-DPI prose at JPEG 70 can exceed the previous 3MB target; allow up to 6MB rather than violate the owner's type/quality floors.
export const EXPORT_IMAGE_TARGET_BYTES = 3000000;
export const EXPORT_IMAGE_BYTES = 6000000;
export const EXPORT_PDF_BYTES = 2000000;
export const EXPORT_IMAGE_HEIGHT = 16000;

export const EXPORT_IMAGE_WIDTH = 1654;
