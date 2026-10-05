import { cronAuthorized } from '@/lib/account-service';
import { dailyMaintenance } from '@/lib/platform/cron';
import { ApiError, errorResponse } from '@/lib/api-error';
import { logger } from '@/lib/logger';
export const dynamic = 'force-dynamic';
/** Vercel Cron cleanup; the bearer secret is required before any database operation. */
export async function POST(request: Request) {
  if (!cronAuthorized(request.headers.get('authorization')))
    return errorResponse(new ApiError('E_UNAUTHORIZED', 'Cron authorization required', 401));
  try {
    return Response.json(
      {
        ok: true,
        data: await dailyMaintenance(),
      },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    logger.error({ err: error }, 'Daily maintenance failed');
    return errorResponse(new ApiError('E_INTERNAL', 'Cleanup failed', 500));
  }
}

// DESIGN-GAP: Vercel Cron invokes GET; the same authenticated handler adapts the documented POST endpoint.
export const GET = POST;
