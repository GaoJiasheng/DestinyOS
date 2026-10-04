import { z } from 'zod';
import { searchCities } from '@/lib/geo';
import { ApiError, errorResponse } from '@/lib/api-error';
const schema = z.object({
  q: z.string().trim().min(1).max(100),
  locale: z.enum(['zh', 'en']).default('zh'),
});
/** Return at most 12 deterministic bilingual GeoNames matches in the documented envelope. */
export async function GET(request: Request) {
  const p = schema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!p.success) return errorResponse(new ApiError('E_VALIDATION', 'Invalid search query', 400));
  try {
    return Response.json(
      { ok: true, data: await searchCities(p.data.q, p.data.locale) },
      { headers: { 'Cache-Control': 'public, max-age=3600' } },
    );
  } catch {
    return errorResponse(new ApiError('E_INTERNAL', 'City search unavailable', 500));
  }
}
