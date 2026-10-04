import { z } from 'zod';
import { find } from 'geo-tz';
import { ApiError, errorResponse } from '@/lib/api-error';
const schema = z.object({
  lat: z.coerce.number().finite().min(-90).max(90),
  lng: z.coerce.number().finite().min(-180).max(180),
});
/** Resolve WGS84 degrees to an IANA timezone using local geo-tz boundary data. */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  if (!params.has('lat') || !params.has('lng'))
    return errorResponse(new ApiError('E_VALIDATION', 'Missing coordinates', 400));
  const p = schema.safeParse(Object.fromEntries(params));
  if (!p.success) return errorResponse(new ApiError('E_VALIDATION', 'Invalid coordinates', 400));
  try {
    const tz = find(p.data.lat, p.data.lng)[0];
    if (!tz) return errorResponse(new ApiError('E_NOT_FOUND', 'Timezone not found', 404));
    return Response.json({ ok: true, data: { tz } });
  } catch {
    return errorResponse(new ApiError('E_INTERNAL', 'Timezone lookup unavailable', 500));
  }
}
