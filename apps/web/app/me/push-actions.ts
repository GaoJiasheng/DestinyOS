'use server';
import { actionError, ApiError } from '@/lib/api-error';
import { auth } from '@/lib/auth';
import { assertRateLimit, ratelimit } from '@/lib/ratelimit';
import {
  assertWebPushEnabled,
  deletePushSubscription,
  pushSubscriptionStatus,
  savePushSubscription,
} from '@/lib/web-push-service';
/** Disabled before identity, so a switched-off feature does no session or database work. */
async function owner(): Promise<string> {
  assertWebPushEnabled();
  const session = await auth();
  if (!session?.user.id) throw new ApiError('E_UNAUTHORIZED', 'Sign in required', 401);
  assertRateLimit(await ratelimit('push', session.user.id));
  return session.user.id;
}
/** Create or update this browser's daily reminder. */
export async function subscribePushAction(raw: unknown) {
  try {
    return { ok: true as const, data: await savePushSubscription(await owner(), raw) };
  } catch (error) {
    return { ok: false as const, error: { code: actionError(error) } };
  }
}
/** Remove this browser's daily reminder. */
export async function unsubscribePushAction(endpoint: unknown) {
  try {
    return { ok: true as const, data: await deletePushSubscription(await owner(), endpoint) };
  } catch (error) {
    return { ok: false as const, error: { code: actionError(error) } };
  }
}
/** Read whether this browser's reminder is active, without touching notification permission. */
export async function pushStatusAction(endpoint: unknown) {
  try {
    return { ok: true as const, data: await pushSubscriptionStatus(await owner(), endpoint) };
  } catch (error) {
    return { ok: false as const, error: { code: actionError(error) } };
  }
}
