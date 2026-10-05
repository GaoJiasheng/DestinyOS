import { verifyDailyCard } from '@/lib/share-service';
import { renderCard } from '@/lib/og-card';
import { ApiError, errorResponse } from '@/lib/api-error';
import { auth } from '@/lib/auth';
import { assertRateLimit, ratelimit } from '@/lib/ratelimit';
import { requestIp } from '@/lib/request-ip';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
/** Verify the signed birth-free daily summary before rendering a PNG. */
export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const card = verifyDailyCard(params.get('payload') ?? '', params.get('signature') ?? '');
    const session = await auth();
    assertRateLimit(await ratelimit('share', session?.user.id ?? requestIp(request.headers)));
    return await renderCard(card);
  } catch (e) {
    return errorResponse(
      e instanceof ApiError ? e : new ApiError('E_VALIDATION', 'Invalid image request', 400),
    );
  }
}
