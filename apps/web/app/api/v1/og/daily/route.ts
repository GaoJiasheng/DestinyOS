import { verifyDailyCard } from '@/lib/share-service';
import { renderCard } from '@/lib/og-card';
import { ApiError, errorResponse } from '@/lib/api-error';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
/** Verify the signed birth-free daily summary before rendering a PNG. */
export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    return await renderCard(
      verifyDailyCard(params.get('payload') ?? '', params.get('signature') ?? ''),
    );
  } catch (e) {
    return errorResponse(
      e instanceof ApiError ? e : new ApiError('E_VALIDATION', 'Invalid image request', 400),
    );
  }
}
