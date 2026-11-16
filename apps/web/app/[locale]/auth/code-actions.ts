'use server';

import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { ApiError } from '@/lib/api-error';
import { loginDeviceCookie, redeemLoginCode } from '@/lib/auth-code';
import { logger } from '@/lib/logger';
import { requestIp } from '@/lib/request-ip';
import { confirmLoginTargetAction } from './actions';

export type CodeState = {
  ok: boolean;
  target?: string;
  code?: 'E_FORMAT' | 'E_CODE' | 'E_RATE_LIMITED' | 'E_INTERNAL';
  /** Tries left for this code; 0 means it is void and a new email is needed. */
  attemptsLeft?: number;
  retryAfter?: number;
};
const codeSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  code: z.string().regex(/^\d{6}$/),
  locale: z.enum(['zh', 'en', 'zh-TW']),
});

/**
 * Sign in with the six-digit code from the email, in the browser that requested it. On success the
 * bound magic-link token is consumed through the same CSRF-protected path as the link itself.
 */
export async function verifyLoginCodeAction(
  locale: string,
  email: string,
  code: string,
): Promise<CodeState> {
  const parsed = codeSchema.safeParse({ email, code, locale });
  if (!parsed.success) return { ok: false, code: 'E_FORMAT' };
  try {
    const jar = await cookies();
    const result = await redeemLoginCode({
      email: parsed.data.email,
      code: parsed.data.code,
      device: jar.get(loginDeviceCookie)?.value,
      ip: requestIp(await headers()),
    });
    if (!result.ok) return { ok: false, code: 'E_CODE', attemptsLeft: result.attemptsLeft };
    jar.delete(loginDeviceCookie);
    return {
      ok: true,
      target: await confirmLoginTargetAction(parsed.data.locale, result.token, parsed.data.email),
    };
  } catch (error) {
    if (error instanceof ApiError && error.code === 'E_RATE_LIMITED')
      return { ok: false, code: 'E_RATE_LIMITED', retryAfter: Number(error.details?.retryAfter) };
    logger.error({ err: error }, 'Sign-in code check failed');
    return { ok: false, code: 'E_INTERNAL' };
  }
}

/** Pre-hydration form fallback: a native POST makes the success redirect a full page load. */
export async function loginCodeFormAction(
  _previous: CodeState,
  form: FormData,
): Promise<CodeState> {
  const state = await verifyLoginCodeAction(
    String(form.get('locale') ?? ''),
    String(form.get('email') ?? ''),
    String(form.get('code') ?? '').replace(/\D/g, ''),
  );
  if (state.ok && state.target) redirect(state.target);
  return state;
}
