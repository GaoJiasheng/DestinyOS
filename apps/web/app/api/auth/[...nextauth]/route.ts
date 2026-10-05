import { requestIp } from '@/lib/request-ip';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { handlers } from '@/lib/auth';
import { verificationSchema } from '@/lib/auth-confirmation';
import { limitMagicLink } from '@/lib/ratelimit';
import { ApiError, errorResponse } from '@/lib/api-error';

/** Guard the actual email callback as well as the email landing page against GET-only scanners. */
export async function GET(request: NextRequest) {
  if (request.nextUrl.pathname === '/api/auth/callback/resend') {
    const callback = request.nextUrl.searchParams.get('callbackUrl') ?? '/zh';
    const locale = new URL(callback, request.nextUrl.origin).pathname.startsWith('/en')
      ? 'en'
      : 'zh';
    const parsed = verificationSchema.safeParse({
      token: request.nextUrl.searchParams.get('token'),
      email: request.nextUrl.searchParams.get('email'),
      locale,
    });
    if (!parsed.success)
      return NextResponse.redirect(
        new URL(`/${locale}/auth/login?error=Verification`, request.url),
      );
    const landing = new URL(`/${locale}/auth/verify`, request.url);
    landing.searchParams.set('token', parsed.data.token);
    landing.searchParams.set('email', parsed.data.email);
    return NextResponse.redirect(landing);
  }
  return handlers.GET(request);
}

/** Native Auth.js email requests obey the same quotas as Server Actions, with uniform 429 responses. */
export async function POST(request: NextRequest) {
  if (request.nextUrl.pathname === '/api/auth/callback/resend')
    return errorResponse(
      new ApiError('E_FORBIDDEN', 'Email confirmation requires the confirmation form', 403),
    );
  if (request.nextUrl.pathname === '/api/auth/signin/resend') {
    try {
      const form = await request.clone().formData();
      const email = z.string().trim().toLowerCase().email().max(254).safeParse(form.get('email'));
      if (!email.success)
        return errorResponse(new ApiError('E_VALIDATION', 'Invalid email address', 400));
      const ip = requestIp(request.headers);
      await limitMagicLink(email.data, ip);
    } catch (error) {
      return errorResponse(
        error instanceof ApiError
          ? error
          : new ApiError('E_INTERNAL', 'Authentication service unavailable', 500),
      );
    }
  }
  return handlers.POST(request);
}
