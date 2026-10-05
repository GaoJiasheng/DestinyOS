import { z } from 'zod';
import { cookies, headers } from 'next/headers';
import { auth } from './auth';
import { ApiError } from './api-error';
import { requestIp } from './request-ip';
import { assertRateLimit, ratelimit } from './ratelimit';
import { runAction } from './action-result';
import type { ActionResult } from './reading-schema';
export const idSchema = z.string().min(1).max(100);
/** Require authentication and return the current owner identifier. */
export async function userId() {
  const session = await auth();
  if (!session?.user.id) throw new ApiError('E_UNAUTHORIZED', 'Sign in required', 401);
  return session.user.id;
}
/** Run a reading action, retaining the existing age-gate cookie on age failures. */
export function run<T>(work: () => Promise<T>): Promise<ActionResult<T>> {
  return runAction(work, async (code) => {
    if (code === 'E_AGE_RESTRICTED') await blockAge();
  });
}
/** Set the documented HTTP-only age gate for the current session. */
export async function blockAge(): Promise<void> {
  (await cookies()).set('age_gate', 'blocked', {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
  });
}
/** Reject reading work for a previously blocked under-age session. */
export async function guardAge() {
  if ((await cookies()).get('age_gate')?.value === 'blocked')
    throw new ApiError('E_AGE_RESTRICTED', 'Age restricted', 403);
}
// DESIGN-GAP: All server interpretation/compute entry points consume the documented report quota.
/** Consume the reading quota for the authenticated plan or anonymous IP. */
export async function limitReadingWork() {
  const session = await auth();
  assertRateLimit(
    await ratelimit(
      session?.user.id
        ? session.user.plan === 'pro'
          ? 'reading.pro'
          : 'reading.free'
        : 'reading.anon',
      session?.user.id ?? requestIp(await headers()),
    ),
  );
}
