import { cronAuthorized, hardDeleteAccounts } from '@/lib/account-service';
import { ApiError, errorResponse } from '@/lib/api-error';
export const dynamic = 'force-dynamic';
/** Vercel Cron cleanup; the bearer secret is required before any database operation. */
export async function POST(request: Request) {
  if (!cronAuthorized(request.headers.get('authorization')))
    return errorResponse(new ApiError('E_UNAUTHORIZED', 'Cron authorization required', 401));
  try {
    return Response.json(
      { ok: true, data: { deleted: await hardDeleteAccounts() } },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch {
    return errorResponse(new ApiError('E_INTERNAL', 'Cleanup failed', 500));
  }
}

// DESIGN-GAP: Vercel Cron invokes GET; the same authenticated handler adapts the documented POST endpoint.
export const GET = POST;
