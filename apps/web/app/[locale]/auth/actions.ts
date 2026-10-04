'use server';

import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { handlers, signIn, signOut } from '@/lib/auth';
import { limitMagicLink } from '@/lib/ratelimit';
import { ApiError } from '@/lib/api-error';
import { verificationSchema } from '@/lib/auth-confirmation';
import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';

export type LoginState = {
  ok: boolean;
  email?: string;
  code?: 'E_VALIDATION' | 'E_RATE_LIMITED' | 'E_INTERNAL';
  retryAfter?: number;
};
const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  locale: z.enum(['zh', 'en']),
});

/** Validate and send an Auth.js magic link with both email and IP sliding-window quotas. */
export async function sendMagicLinkAction(email: string, locale: string): Promise<LoginState> {
  const parsed = loginSchema.safeParse({ email, locale });
  if (!parsed.success) return { ok: false, code: 'E_VALIDATION' };
  try {
    const requestHeaders = await headers();
    // DESIGN-GAP: Deploy behind a proxy that overwrites x-forwarded-for (Vercel); absent IPs share a safe fallback bucket.
    const ip = requestHeaders.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    await limitMagicLink(parsed.data.email, ip);
    const result: unknown = await signIn('resend', {
      email: parsed.data.email,
      redirect: false,
      redirectTo: `/${parsed.data.locale}`,
    });
    if (typeof result !== 'string' || new URL(result, 'http://localhost').searchParams.has('error'))
      throw new Error('Authentication request failed');
    return { ok: true, email: parsed.data.email };
  } catch (error) {
    if (error instanceof ApiError && error.code === 'E_RATE_LIMITED')
      return { ok: false, code: 'E_RATE_LIMITED', retryAfter: Number(error.details?.retryAfter) };
    logger.error({ err: error }, 'Magic-link request failed');
    return { ok: false, code: 'E_INTERNAL' };
  }
}

/** React form adapter for the documented sendMagicLinkAction(email, locale) API. */
export async function loginFormAction(_previous: LoginState, form: FormData): Promise<LoginState> {
  return sendMagicLinkAction(String(form.get('email') ?? ''), String(form.get('locale') ?? ''));
}

/** Start Google OAuth and return to the validated locale home. */
export async function googleLoginAction(locale: string): Promise<void> {
  const valid = z.enum(['zh', 'en']).parse(locale);
  await signIn('google', { redirectTo: `/${valid}` });
}

/** Confirm login only after a CSRF-protected form submission, then let Auth.js consume the token. */
export async function confirmLoginAction(
  locale: string,
  token: string,
  email: string,
): Promise<void> {
  const parsed = verificationSchema.safeParse({ locale, token, email });
  if (!parsed.success) redirect(`/${locale === 'en' ? 'en' : 'zh'}/auth/login?error=Verification`);
  const requestHeaders = new Headers(await headers());
  const origin = requestHeaders.get('origin') ?? process.env.NEXT_PUBLIC_SITE_URL;
  if (!origin) throw new Error('Site origin is required');
  const callback = new URL('/api/auth/callback/resend', origin);
  callback.search = new URLSearchParams({
    token: parsed.data.token,
    email: parsed.data.email,
    callbackUrl: `/${parsed.data.locale}`,
  }).toString();
  // DESIGN-GAP: Consume through Auth.js inside the CSRF-protected action. Public email GET callbacks
  // only show confirmation; redirecting via a Route Handler breaks Server Action router navigation.
  const response = await handlers.GET(new NextRequest(callback, { headers: requestHeaders }));
  const returned = new NextResponse(null, { status: response.status, headers: response.headers });
  const jar = await cookies();
  for (const cookie of returned.cookies.getAll()) jar.set(cookie.name, cookie.value, cookie);
  const target = new URL(
    response.headers.get('Location') ?? `/${parsed.data.locale}/auth/login?error=Verification`,
    origin,
  );
  if (target.origin !== new URL(origin).origin)
    redirect(`/${parsed.data.locale}/auth/login?error=Verification`);
  redirect(`${target.pathname}${target.search}`);
}

/** Revoke the database session and return to the localized login page. */
export async function logoutAction(locale: string): Promise<void> {
  await signOut({ redirectTo: `/${locale === 'en' ? 'en' : 'zh'}/auth/login` });
}
