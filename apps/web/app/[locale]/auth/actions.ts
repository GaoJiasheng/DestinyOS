'use server';

import { isLocale } from '@/i18n/routing';
import { requestIp } from '@/lib/request-ip';
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { handlers, signIn, signOut } from '@/lib/auth';
import { limitMagicLink } from '@/lib/ratelimit';
import { ApiError } from '@/lib/api-error';
import { verificationSchema } from '@/lib/auth-confirmation';
import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { sendAccountDeletedEmail } from '@/lib/auth-email';
import { returnCookie, safeReturnPath } from './return-path';
import { accountDeletedError, parseUntil } from '@/lib/auth-notice';

export type LoginState = {
  ok: boolean;
  email?: string;
  code?: 'E_VALIDATION' | 'E_RATE_LIMITED' | 'E_INTERNAL';
  retryAfter?: number;
};
const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  locale: z.enum(['zh', 'en', 'zh-TW']),
});

/** Read `callbackUrl` from the login page URL when the form did not submit one. */
function refererCallback(requestHeaders: Headers): string | undefined {
  try {
    const referer = requestHeaders.get('referer');
    const host = requestHeaders.get('host');
    if (!referer || !host) return undefined;
    const url = new URL(referer);
    return url.host === host ? (url.searchParams.get('callbackUrl') ?? undefined) : undefined;
  } catch {
    return undefined;
  }
}

/** Validate and send an Auth.js magic link with both email and IP sliding-window quotas. */
export async function sendMagicLinkAction(
  email: string,
  locale: string,
  callbackUrl?: string,
): Promise<LoginState> {
  const parsed = loginSchema.safeParse({ email, locale });
  if (!parsed.success) return { ok: false, code: 'E_VALIDATION' };
  try {
    const requestHeaders = await headers();
    const ip = requestIp(requestHeaders);
    await limitMagicLink(parsed.data.email, ip);
    const returnTo = safeReturnPath(
      callbackUrl || refererCallback(requestHeaders),
      parsed.data.locale,
    );
    const result: unknown = await signIn('resend', {
      email: parsed.data.email,
      redirect: false,
      redirectTo: returnTo,
    });
    const query =
      typeof result === 'string' ? new URL(result, 'http://localhost').searchParams : null;
    if (query?.get('error') === accountDeletedError) {
      // Whether an address belongs to a recently deleted account is told only to its mailbox;
      // the page answers exactly as it does for any other address.
      await sendAccountDeletedEmail(
        parsed.data.email,
        parsed.data.locale,
        parseUntil(query.get('until')),
      ).catch((error: unknown) => logger.error({ err: error }, 'Deleted-account notice failed'));
      return { ok: true, email: parsed.data.email };
    }
    if (!query || query.has('error')) throw new Error('Authentication request failed');
    // DESIGN-GAP: The emailed confirmation link carries only token/email, so the destination waits in a short-lived same-browser cookie; another device lands on home.
    (await cookies()).set(returnCookie, returnTo, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 15 * 60,
    });
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
  const callbackUrl = form.get('callbackUrl');
  return sendMagicLinkAction(
    String(form.get('email') ?? ''),
    String(form.get('locale') ?? ''),
    typeof callbackUrl === 'string' ? callbackUrl : undefined,
  );
}

/** Start Google OAuth and return to the validated same-origin page, or the locale home. */
export async function googleLoginAction(locale: string, callbackUrl?: string): Promise<void> {
  const valid = z.enum(['zh', 'en', 'zh-TW']).parse(locale);
  await signIn('google', { redirectTo: safeReturnPath(callbackUrl, valid) });
}

/** Let Auth.js consume the token inside a CSRF-protected action; resolves to the same-origin destination. */
async function confirmLogin(
  locale: string,
  token: string,
  email: string,
  returnTo?: string,
): Promise<string> {
  const parsed = verificationSchema.safeParse({ locale, token, email });
  if (!parsed.success) return `/${isLocale(locale) ? locale : 'zh'}/auth/login?error=Verification`;
  const requestHeaders = new Headers(await headers());
  const origin = requestHeaders.get('origin') ?? process.env.NEXT_PUBLIC_SITE_URL;
  if (!origin) throw new Error('Site origin is required');
  const jar = await cookies();
  const stored = jar.get(returnCookie)?.value;
  const callback = new URL('/api/auth/callback/resend', origin);
  callback.search = new URLSearchParams({
    token: parsed.data.token,
    email: parsed.data.email,
    callbackUrl:
      returnTo === '/admin' ? '/admin' : safeReturnPath(returnTo || stored, parsed.data.locale),
  }).toString();
  // DESIGN-GAP: Consume through Auth.js inside the CSRF-protected action. Public email GET callbacks
  // only show confirmation; redirecting via a Route Handler breaks Server Action router navigation.
  const response = await handlers.GET(new NextRequest(callback, { headers: requestHeaders }));
  const returned = new NextResponse(null, { status: response.status, headers: response.headers });
  if (stored) jar.delete(returnCookie);
  for (const cookie of returned.cookies.getAll()) jar.set(cookie.name, cookie.value, cookie);
  const target = new URL(
    response.headers.get('Location') ?? `/${parsed.data.locale}/auth/login?error=Verification`,
    origin,
  );
  if (target.origin !== new URL(origin).origin)
    return `/${parsed.data.locale}/auth/login?error=Verification`;
  return `${target.pathname}${target.search}`;
}

/** Pre-hydration form fallback: a native POST makes this redirect a full page load. */
export async function confirmLoginAction(
  locale: string,
  token: string,
  email: string,
  returnTo?: string,
): Promise<void> {
  redirect(await confirmLogin(locale, token, email, returnTo));
}

/** Hydrated confirmation: the client performs a full navigation so the shell re-reads the session. */
export async function confirmLoginTargetAction(
  locale: string,
  token: string,
  email: string,
  returnTo?: string,
): Promise<string> {
  return confirmLogin(locale, token, email, returnTo);
}

/** Revoke the database session and return to the localized login page (pre-hydration fallback). */
export async function logoutAction(locale: string): Promise<void> {
  await signOut({ redirectTo: `/${isLocale(locale) ? locale : 'zh'}/auth/login` });
}

/** Revoke the session without a router redirect; the client then reloads the page so the shell drops its signed-in state. */
export async function logoutTargetAction(locale: string): Promise<string> {
  const target = `/${isLocale(locale) ? locale : 'zh'}/auth/login`;
  await signOut({ redirect: false, redirectTo: target });
  return target;
}
