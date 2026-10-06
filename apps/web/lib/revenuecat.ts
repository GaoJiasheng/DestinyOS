import { z } from 'zod';
import { ApiError } from './api-error';
import { logger } from './logger';

const endpoint = 'https://api.revenuecat.com/v1';
const date = z.string().datetime({ offset: true }).nullable();
const customerSchema = z.object({
  subscriber: z.object({
    entitlements: z.record(
      z.object({ expires_date: date, grace_period_expires_date: date.optional() }),
    ),
  }),
});

/** Import a Stripe subscription ID or a paid lifetime Checkout Session ID under the same User.id. */
export async function syncStripePurchase(userId: string, fetchToken: string): Promise<void> {
  const key = process.env.REVENUECAT_SECRET_KEY;
  if (!key) {
    logger.warn(
      { provider: 'revenuecat', reason: 'missing_secret_key' },
      'Stripe purchase sync skipped',
    );
    return;
  }
  // DESIGN-GAP: Receipt imports can require the Stripe app public API key; keep it server-side and fall back to the configured secret key.
  await request('/receipts', process.env.REVENUECAT_STRIPE_API_KEY || key, {
    method: 'POST',
    headers: { 'X-Platform': 'stripe' },
    body: JSON.stringify({ app_user_id: userId, fetch_token: fetchToken }),
  });
}

async function request(path: string, key: string, options: RequestInit = {}) {
  try {
    const response = await fetch(`${endpoint}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`,
        ...options.headers,
      },
      cache: 'no-store',
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) throw new Error('Provider rejected request');
    return response;
  } catch {
    logger.warn(
      { provider: 'revenuecat', reason: 'request_failed' },
      'RevenueCat synchronization will retry',
    );
    throw new ApiError('E_PAYMENT', 'RevenueCat synchronization failed; retry', 503);
  }
}

/** Fetch authoritative pro entitlement so duplicate/out-of-order events and cancellation grace retain access. */
export async function revenuecatEntitlement(userId: string) {
  const key = process.env.REVENUECAT_SECRET_KEY;
  if (!key) throw new ApiError('E_PAYMENT', 'RevenueCat unavailable', 503);
  const response = await request(`/subscribers/${encodeURIComponent(userId)}`, key);
  const parsed = customerSchema.safeParse(await response.json());
  if (!parsed.success) throw new ApiError('E_PAYMENT', 'Invalid RevenueCat customer response', 503);
  const pro = parsed.data.subscriber.entitlements.pro;
  const lifetime = Boolean(pro && pro.expires_date === null);
  const until = pro?.expires_date ? new Date(pro.expires_date) : null;
  const grace = pro?.grace_period_expires_date ? new Date(pro.grace_period_expires_date) : null;
  const expiry = grace && (!until || grace > until) ? grace : until;
  return {
    lifetime,
    until: expiry,
    active: lifetime || Boolean(expiry && expiry.getTime() > Date.now()),
  };
}
