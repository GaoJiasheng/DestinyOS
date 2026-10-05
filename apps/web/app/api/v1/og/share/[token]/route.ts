import { z } from 'zod';
import { publicShare } from '@/lib/share-service';
import { renderCard } from '@/lib/og-card';
import { ApiError, errorResponse } from '@/lib/api-error';
import { auth } from '@/lib/auth';
import { assertRateLimit, ratelimit } from '@/lib/ratelimit';
import { requestIp } from '@/lib/request-ip';
// DESIGN-GAP: The encrypted Prisma adapter requires Node; @vercel/og runs in the supported Node route runtime.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
/** Resolve active shares on every image request so revocation takes effect immediately. */
export async function GET(request: Request, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params;
    const url = new URL(request.url);
    const locale = z
      .enum(['zh', 'en', 'zh-TW'])
      .optional()
      .parse(url.searchParams.get('locale') ?? undefined);
    const format = z
      .enum(['story', 'landscape'])
      .parse(url.searchParams.get('format') ?? 'landscape');
    const session = await auth();
    assertRateLimit(await ratelimit('share', session?.user.id ?? requestIp(request.headers)));
    const share = await publicShare(token, locale);
    const destination = new URL(`/s/${token}`, process.env.NEXT_PUBLIC_SITE_URL ?? request.url);
    destination.searchParams.set('locale', share.locale);
    const image = await renderCard(share.daily ?? share, format, destination.toString());
    // DESIGN-GAP: Immediate share/account revocation takes precedence over the one-day OG cache.
    image.headers.set('Cache-Control', 'private, no-store');
    return image;
  } catch (e) {
    return errorResponse(
      e instanceof ApiError ? e : new ApiError('E_VALIDATION', 'Invalid image request', 400),
    );
  }
}
