import { z } from 'zod';
import type { Emphasis, EmphasisLevel, Report } from '@tianji/interpret';
// Browser-safe: used by IndexedDB snapshots, report validation and the public share projection.
const dim = z.enum(['career', 'wealth', 'love', 'health', 'social']);
const level = z.union([z.literal(2), z.literal(3), z.literal(4), z.literal(5)]);
const key = z.string().regex(/^[a-z0-9_.-]{1,48}$/);
const basis = z
  .object({
    ruleId: key,
    delta: z.number().finite().min(-5).max(5),
    params: z
      .record(z.string().regex(/^[A-Za-z]{1,24}$/), z.string().max(160))
      .refine((value) => Object.keys(value).length <= 8),
  })
  .strict();
const dimension = z
  .object({
    level,
    raw: z.number().finite().min(-10).max(10),
    basis: z.array(basis).max(24),
  })
  .strict();
/** Stored chart emphasis (P1 contract); strict so tampered device snapshots cannot smuggle fields. */
export const EmphasisSchema: z.ZodType<Emphasis> = z
  .object({
    version: z.string().regex(/^\d{1,4}\.\d{1,4}\.\d{1,6}$/),
    dims: z
      .object({
        career: dimension.optional(),
        wealth: dimension.optional(),
        love: dimension.optional(),
        health: dimension.optional(),
        social: dimension.optional(),
      })
      .strict(),
    top: z.array(dim).max(2),
    omitted: z.array(dim).max(5),
  })
  .strict();
/** The only emphasis a public share carries: the strongest dimension, and only at band 4 or 5. */
export const PublicEmphasisSchema = z
  .object({
    dim: z.enum(['career', 'wealth', 'love', 'social']),
    level: z.union([z.literal(4), z.literal(5)]),
  })
  .strict();
export type PublicEmphasis = z.infer<typeof PublicEmphasisSchema>;
/** Reduce a stored emphasis to its public part; anything else (bands 2–3, basis, raw) never leaves. */
export function publicEmphasis(emphasis: Emphasis | undefined): PublicEmphasis | undefined {
  const first = emphasis?.top[0];
  const found = first ? emphasis.dims[first] : undefined;
  if (!first || !found) return undefined;
  const parsed = PublicEmphasisSchema.safeParse({ dim: first, level: found.level });
  return parsed.success ? parsed.data : undefined;
}
type Headed = { headline: object };
const headed = (value: unknown): value is Headed =>
  Boolean(value) &&
  typeof value === 'object' &&
  'headline' in (value as object) &&
  Boolean((value as Headed).headline) &&
  typeof (value as Headed).headline === 'object';
/** Give a report exactly this emphasis (or none), so every locale of one reading shows the same saved
 * bands and a language switch only re-renders them. Returns the same object when nothing changes. */
export function withEmphasis<T extends Headed>(report: T, emphasis: Emphasis | undefined): T {
  const { emphasis: current, ...headline } = report.headline as { emphasis?: unknown };
  if (JSON.stringify(current) === JSON.stringify(emphasis)) return report;
  return { ...report, headline: emphasis ? { ...headline, emphasis } : headline };
}
/** Stored emphasis of an untrusted report-shaped value, when it is valid. */
export function storedEmphasis(report: unknown): Emphasis | undefined {
  if (!headed(report)) return undefined;
  const parsed = EmphasisSchema.safeParse((report.headline as { emphasis?: unknown }).emphasis);
  return parsed.success ? parsed.data : undefined;
}
/** A translation generated later takes the emphasis stored with the sibling locale's report (or none). */
export function siblingEmphasis(report: Report, sibling: unknown): Report {
  return withEmphasis(report, storedEmphasis(sibling));
}
/** A stored sibling report (raw JSON) updated to `emphasis`, or null when it is absent or already equal. */
export function syncedSibling(sibling: unknown, emphasis: Emphasis | undefined): Headed | null {
  if (!headed(sibling)) return null;
  const next = withEmphasis(sibling, emphasis);
  return next === sibling ? null : next;
}
/** Apply one emphasis to every cached locale of a device reading after it is regenerated. */
export function syncEmphasis<
  T extends { report: Report; reportZh?: Report; reportZhTw?: Report; reportEn?: Report },
>(reading: T, emphasis: Emphasis | undefined): T {
  const each = (report?: Report) => (report ? withEmphasis(report, emphasis) : report);
  return {
    ...reading,
    report: withEmphasis(reading.report, emphasis),
    ...(reading.reportZh ? { reportZh: each(reading.reportZh) } : {}),
    ...(reading.reportZhTw ? { reportZhTw: each(reading.reportZhTw) } : {}),
    ...(reading.reportEn ? { reportEn: each(reading.reportEn) } : {}),
  };
}
/** A device reading after "regenerate": the new report becomes the original and this locale's cached
 * copy, and its emphasis (or none) is applied to the other cached locales too. */
export function regeneratedReading<
  T extends { report: Report; reportZh?: Report; reportZhTw?: Report; reportEn?: Report },
>(reading: T, locale: 'zh' | 'en' | 'zh-TW', report: Report): T {
  const slot = locale === 'zh-TW' ? 'reportZhTw' : locale === 'zh' ? 'reportZh' : 'reportEn';
  return syncEmphasis({ ...reading, report, [slot]: report }, report.headline.emphasis);
}
export type { Emphasis, EmphasisLevel };
