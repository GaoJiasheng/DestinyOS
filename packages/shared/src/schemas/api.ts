import { z } from 'zod';

/** docs/07 JSON failure envelope; messages are developer information, never display copy. */
export const ApiFailureSchema = z.object({
  ok: z.literal(false),
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.record(z.unknown()).optional(),
  }),
});

/** docs/07 success envelope, with the endpoint's schema validating its data. */
export function apiSuccessSchema<T extends z.ZodType<unknown>>(data: T) {
  return z.object({ ok: z.literal(true), data });
}

export const CitySchema = z.object({
  name: z.string(),
  country: z.string(),
  admin: z.string(),
  lat: z.number(),
  lng: z.number(),
  tz: z.string(),
});
export type City = z.infer<typeof CitySchema>;
export const GeoSearchRequestSchema = z.object({
  q: z.string().trim().min(1).max(100),
  locale: z.enum(['zh', 'en', 'zh-TW']).default('zh'),
});
export const GeoSearchResponseSchema = z.array(CitySchema);
export const GeoTimezoneRequestSchema = z.object({
  lat: z.string().trim().min(1).pipe(z.coerce.number().finite().min(-90).max(90)),
  lng: z.string().trim().min(1).pipe(z.coerce.number().finite().min(-180).max(180)),
});
export const GeoTimezoneResponseSchema = z.object({ tz: z.string() });
